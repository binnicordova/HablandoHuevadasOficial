import type {CatalogItem, Video, VideoKind} from "@/models/video";
import {dayKey, hashString} from "@/utils/date";
import {normalize} from "@/utils/format";
import {getYoutubeVideoId, isValidVideoId, thumbnailUrl} from "@/utils/youtube";

type RawDataset = {
    channel: string;
    videos: Video[];
    shorts: Video[];
};

type Catalog = {
    channel: string;
    videos: CatalogItem[];
    shorts: CatalogItem[];
    /** Every item indexed by id for O(1) lookups from deep links and history. */
    byId: Map<string, CatalogItem>;
    /** Pre-normalised haystack per id so search never re-normalises 3.6k strings. */
    searchIndex: Map<string, string>;
};

let cache: Catalog | null = null;

const toCatalogItem = (raw: Video, kind: VideoKind): CatalogItem => {
    const id = isValidVideoId(raw.id) ? raw.id : getYoutubeVideoId(raw.link);
    return {
        ...raw,
        id: id ?? raw.id,
        kind,
        // Rebuild the cover from the id: the bundled URLs carry signed params
        // that expire and leave the list full of grey boxes.
        thumbnail: id
            ? thumbnailUrl(id, kind === "short" ? "hq" : "mq")
            : raw.thumbnail,
    };
};

/**
 * Parses the bundled dataset once, lazily. Deferring the require keeps the 3.3MB
 * JSON parse off the cold-start critical path until the first screen asks for it.
 */
export const getCatalog = (): Catalog => {
    if (cache) return cache;

    const data = require("@assets/data/data.json") as RawDataset;
    const videos = (data.videos ?? []).map((v) => toCatalogItem(v, "video"));
    const shorts = (data.shorts ?? []).map((v) => toCatalogItem(v, "short"));

    const byId = new Map<string, CatalogItem>();
    const searchIndex = new Map<string, string>();
    for (const item of [...videos, ...shorts]) {
        if (byId.has(item.id)) continue;
        byId.set(item.id, item);
        searchIndex.set(
            item.id,
            normalize(
                [
                    item.title,
                    item.title_clean,
                    item.season,
                    item.season_short,
                    item.series,
                    item.description ?? "",
                ]
                    .filter(Boolean)
                    .join(" ")
            )
        );
    }

    cache = {channel: data.channel, videos, shorts, byId, searchIndex};
    return cache;
};

export const getVideos = (): CatalogItem[] => getCatalog().videos;
export const getShorts = (): CatalogItem[] => getCatalog().shorts;

export const getItemById = (id: string): CatalogItem | undefined =>
    getCatalog().byId.get(id);

export const getItemsByIds = (ids: string[]): CatalogItem[] => {
    const {byId} = getCatalog();
    const out: CatalogItem[] = [];
    for (const id of ids) {
        const item = byId.get(id);
        if (item) out.push(item);
    }
    return out;
};

/**
 * Deterministic pick of the day: same clip for every user on a given date, which
 * is what makes it shareable ("¿viste la huevada de hoy?").
 */
export const getDailyPick = (date: Date = new Date()): CatalogItem | null => {
    const pool = getVideos();
    if (pool.length === 0) return null;
    return pool[hashString(dayKey(date)) % pool.length];
};

export const getDailyShort = (date: Date = new Date()): CatalogItem | null => {
    const pool = getShorts();
    if (pool.length === 0) return null;
    return pool[hashString(`short-${dayKey(date)}`) % pool.length];
};

/** Shorts feed reshuffled per day so the vertical feed is not identical forever. */
export const getShuffledShorts = (date: Date = new Date()): CatalogItem[] => {
    const pool = getShorts();
    if (pool.length === 0) return pool;
    const offset = hashString(dayKey(date)) % pool.length;
    return [...pool.slice(offset), ...pool.slice(0, offset)];
};

/**
 * Views alone rank the old viral clips above everything. Likes per view is the
 * closer proxy for "people liked it", so a strong ratio lifts a video by up to
 * 50% — enough to reorder neighbours, not enough to float a 2k-view clip.
 */
export const popularity = (item: CatalogItem): number => {
    const views = item.view_count ?? 0;
    if (!item.like_ratio) return views;
    // 1.4% likes/views is roughly this channel's average.
    return views * (1 + Math.min(item.like_ratio / 0.014, 1.5) * 0.5);
};

export type SearchOptions = {
    kind?: VideoKind | "all";
    limit?: number;
};

/**
 * Token-AND search over the pre-normalised index. Results are ranked by title
 * prefix match first, then by popularity, so the obvious hit lands on top. The
 * index also carries the clean title and the season, so "temporada 12" and
 * "el guardia" both find the episode.
 */
export const searchCatalog = (
    query: string,
    {kind = "all", limit = 60}: SearchOptions = {}
): CatalogItem[] => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const {videos, shorts, searchIndex} = getCatalog();
    const pool =
        kind === "video"
            ? videos
            : kind === "short"
              ? shorts
              : [...videos, ...shorts];

    const scored: {item: CatalogItem; score: number}[] = [];
    for (const item of pool) {
        const haystack = searchIndex.get(item.id);
        if (!haystack) continue;
        if (!terms.every((term) => haystack.includes(term))) continue;

        const startsWith = terms.some((term) => haystack.startsWith(term))
            ? 1_000_000_000
            : 0;
        scored.push({item, score: startsWith + popularity(item)});
        if (scored.length >= limit * 4) break;
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.item);
};

/**
 * "Porque viste X": the best of the same season first, then the neighbours in
 * the list. Season is the strongest similarity signal the dataset carries — the
 * cast, the era and the running gags all move together with it.
 *
 * Pure over whatever pool it is handed, so the rail engine can run it on a
 * filtered catalog and the tests can run it on a synthetic one.
 */
export const relatedIn = (
    item: CatalogItem,
    pool: CatalogItem[],
    count = 10
): CatalogItem[] => {
    const id = item.id;

    const out: CatalogItem[] = [];
    const taken = new Set([id]);

    if (item.season) {
        /*
         * Half the row, but never more than six. Callers over-fetch this list
         * so they have headroom after de-duplication, and an uncapped half
         * would let one rail swallow most of a season — starving the "más de
         * esta temporada" row that comes right after it.
         */
        const seasonSlots = Math.ceil(Math.min(count, 12) / 2);
        const sameSeason = pool
            .filter(
                (candidate) =>
                    candidate.season === item.season && candidate.id !== id
            )
            .sort((a, b) => popularity(b) - popularity(a))
            .slice(0, seasonSlots);
        for (const candidate of sameSeason) {
            out.push(candidate);
            taken.add(candidate.id);
        }
    }

    const index = pool.findIndex((candidate) => candidate.id === id);
    const neighbours =
        index === -1
            ? pool
            : [
                  ...pool.slice(index + 1, index + 1 + count),
                  ...pool.slice(Math.max(0, index - count), index),
              ];
    for (const candidate of neighbours) {
        if (out.length >= count) break;
        if (taken.has(candidate.id)) continue;
        out.push(candidate);
        taken.add(candidate.id);
    }

    return out.slice(0, count);
};

/** Same thing, resolved against the bundled catalog. */
export const getRelated = (id: string, count = 10): CatalogItem[] => {
    const item = getItemById(id);
    if (!item) return [];
    return relatedIn(
        item,
        item.kind === "short" ? getShorts() : getVideos(),
        count
    );
};

/** Used by tests and by the reset flow. */
export const resetCatalogCache = () => {
    cache = null;
};
