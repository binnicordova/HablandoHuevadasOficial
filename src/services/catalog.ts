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
            normalize(`${item.title} ${item.description ?? ""}`)
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

export type SearchOptions = {
    kind?: VideoKind | "all";
    limit?: number;
};

/**
 * Token-AND search over the pre-normalised index. Results are ranked by title
 * prefix match first, then by view count, so the obvious hit lands on top.
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
        scored.push({item, score: startsWith + (item.view_count ?? 0)});
        if (scored.length >= limit * 4) break;
    }

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry) => entry.item);
};

/** "Porque viste X": same-collection neighbours, cheap and good enough. */
export const getRelated = (id: string, count = 10): CatalogItem[] => {
    const item = getItemById(id);
    if (!item) return [];
    const pool = item.kind === "short" ? getShorts() : getVideos();
    const index = pool.findIndex((candidate) => candidate.id === id);
    if (index === -1) return pool.slice(0, count);
    const before = pool.slice(Math.max(0, index - count), index);
    const after = pool.slice(index + 1, index + 1 + count);
    return [...after, ...before].slice(0, count);
};

/** Used by tests and by the reset flow. */
export const resetCatalogCache = () => {
    cache = null;
};
