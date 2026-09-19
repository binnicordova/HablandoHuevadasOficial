import type {CatalogItem, HistoryEntry} from "@/models/video";
import {displayTitle, normalize} from "@/utils/format";

/**
 * The taste profile — one read of "what does this cabro actually like".
 *
 * It used to live inside the notification planner, which meant the pushes knew
 * the user and the home screen did not. Same signals, same weights, one place:
 * whatever earns a push at 21:15 is also what earns a rail on Inicio.
 *
 * Pure and synchronous on purpose — no storage, no clock, no expo — so both
 * callers can rebuild it on every render and the whole thing stays testable.
 */

/**
 * Words that appear in half the catalog carry no signal. Dropping them stops
 * "hablando" and "temporada" from making every episode look related to every
 * other one.
 */
export const STOPWORDS = new Set([
    "para",
    "como",
    "pero",
    "esta",
    "este",
    "esos",
    "esas",
    "todo",
    "toda",
    "hace",
    "hacer",
    "cuando",
    "donde",
    "porque",
    "sobre",
    "entre",
    "desde",
    "hasta",
    "mientras",
    "temporada",
    "hablando",
    "huevadas",
    "bonus",
    "track",
]);

export const tokenize = (text: string): string[] =>
    normalize(text)
        .replace(/[^a-z0-9ñ ]+/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !STOPWORDS.has(word));

export type Taste = {
    /** Everything the user has opened, whether or not they finished it. */
    watched: Set<string>;
    /** id -> progress 0..1 for anything started and left hanging. */
    unfinished: Map<string, number>;
    favorites: Set<string>;
    /** Title tokens, weighted by how recent and how explicit the signal was. */
    tokens: Map<string, number>;
    seasons: Map<string, number>;
    /** Ids to keep out of any pick (already pushed, already on another rail). */
    recent: Set<string>;
    /**
     * True when we know nothing at all about this user. Every surface needs
     * it: a "hecho para ti" rail built from zero signal is a lie, and lying on
     * day one is how you teach someone to ignore the rail forever.
     */
    isCold: boolean;
};

export type TasteInput = {
    videos: CatalogItem[];
    shorts: CatalogItem[];
    /** Newest first, the shape `historyAtom` already stores. */
    history: HistoryEntry[];
    favoriteIds: string[];
    /** Ids that must not be picked again for now. */
    excludeIds?: string[];
};

/** How far back the profile looks. Older than this is who the user *was*. */
const HISTORY_WINDOW = 30;

/** An item counts as "left hanging" between these two fractions. */
const RESUME_FLOOR = 0.02;
const RESUME_CEILING = 0.9;

const bump = (map: Map<string, number>, key: string, weight: number) => {
    map.set(key, (map.get(key) ?? 0) + weight);
};

export const buildTaste = (input: TasteInput): Taste => {
    const watched = new Set<string>();
    const unfinished = new Map<string, number>();
    const tokens = new Map<string, number>();
    const seasons = new Map<string, number>();
    const byId = new Map<string, CatalogItem>();
    for (const item of [...input.videos, ...input.shorts])
        byId.set(item.id, item);

    // Recent history counts for more than old history: taste drifts, and the
    // last five things watched describe this week's mood.
    input.history.slice(0, HISTORY_WINDOW).forEach((entry, index) => {
        watched.add(entry.id);
        const weight = index < 5 ? 3 : index < 15 ? 2 : 1;
        const item = byId.get(entry.id);
        if (!item) return;
        if (item.season) bump(seasons, item.season, weight);
        for (const token of tokenize(displayTitle(item))) {
            bump(tokens, token, weight);
        }
        if (entry.durationSeconds > 0) {
            const progress = entry.positionSeconds / entry.durationSeconds;
            if (progress > RESUME_FLOOR && progress < RESUME_CEILING) {
                unfinished.set(entry.id, progress);
            }
        }
    });

    // A favourite is an explicit signal, so it outweighs a passive watch.
    for (const id of input.favoriteIds) {
        const item = byId.get(id);
        if (!item) continue;
        if (item.season) bump(seasons, item.season, 4);
        for (const token of tokenize(displayTitle(item)))
            bump(tokens, token, 4);
    }

    return {
        watched,
        unfinished,
        favorites: new Set(input.favoriteIds),
        tokens,
        seasons,
        recent: new Set(input.excludeIds ?? []),
        // Watches and saves, not tokens: a title the tokeniser finds nothing
        // in is still a user who told us they watch this show.
        isCold: watched.size === 0 && input.favoriteIds.length === 0,
    };
};

/**
 * 0..1 — how much this item looks like the ones the user already chose.
 *
 * A cold profile returns a flat 0.35 so the term never dominates the ranking
 * before it means anything.
 */
export const affinityScore = (item: CatalogItem, taste: Taste): number => {
    if (taste.tokens.size === 0) return 0.35;
    let hits = 0;
    for (const token of tokenize(displayTitle(item))) {
        hits += taste.tokens.get(token) ?? 0;
    }
    const seasonHits = item.season ? (taste.seasons.get(item.season) ?? 0) : 0;
    return Math.min((hits + seasonHits * 2) / 24, 1);
};

/** The seasons this user keeps coming back to, strongest first. */
export const topSeasons = (taste: Taste, count = 3): string[] =>
    [...taste.seasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(([season]) => season);
