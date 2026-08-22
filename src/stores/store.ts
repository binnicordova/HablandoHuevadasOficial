import {atom} from "jotai";
import {STORAGE_ID} from "@/constants/storage";
import type {CatalogItem, HistoryEntry, StreakState} from "@/models/video";
import {getItemsByIds, getShuffledShorts, getVideos} from "@/services/catalog";
import {persistedAtom} from "@/stores/persist";

const HISTORY_LIMIT = 60;
const RECENT_SEARCH_LIMIT = 8;

/*
 * Catalog atoms are plain in-memory atoms on purpose. The previous build wrote
 * the whole 3.3MB dataset into AsyncStorage on every launch, which blocks the
 * JS thread and can blow past Android's AsyncStorage size limit. The dataset is
 * already bundled, so persisting it buys nothing.
 */
export const videosAtom = atom<CatalogItem[]>((): CatalogItem[] => getVideos());
export const shortsAtom = atom<CatalogItem[]>((): CatalogItem[] =>
    getShuffledShorts()
);

/* ---------------------------------- user state --------------------------- */

export const favoriteIdsAtom = persistedAtom<string[]>(
    STORAGE_ID.favorites,
    []
);

export const historyAtom = persistedAtom<HistoryEntry[]>(
    STORAGE_ID.history,
    []
);

export const streakAtom = persistedAtom<StreakState>(STORAGE_ID.streak, {
    current: 0,
    best: 0,
    lastDay: null,
    totalDays: 0,
});

export type Settings = {
    dailyNotification: boolean;
    /** 0-23 local hour for the daily reminder. */
    reminderHour: number;
    autoplay: boolean;
    reduceMotion: boolean;
};

export const settingsAtom = persistedAtom<Settings>(STORAGE_ID.settings, {
    dailyNotification: false,
    reminderHour: 19,
    autoplay: true,
    reduceMotion: false,
});

export type Engagement = {
    /** Number of app opens, used to time the permission and share prompts. */
    sessions: number;
    /** Videos actually started, the real signal that we delivered value. */
    playsStarted: number;
    firstOpenAt: number | null;
    lastPromptAt: number | null;
    lastShareAt: number | null;
    notificationPromptSeen: boolean;
};

export const engagementAtom = persistedAtom<Engagement>(STORAGE_ID.engagement, {
    sessions: 0,
    playsStarted: 0,
    firstOpenAt: null,
    lastPromptAt: null,
    lastShareAt: null,
    notificationPromptSeen: false,
});

export const recentSearchesAtom = persistedAtom<string[]>(
    STORAGE_ID.recentSearches,
    []
);

/* --------------------------------- derived -------------------------------- */

export const favoriteItemsAtom = atom((get) =>
    getItemsByIds(get(favoriteIdsAtom))
);

export type HistoryRow = {entry: HistoryEntry; item: CatalogItem};

export const historyItemsAtom = atom<HistoryRow[]>((get): HistoryRow[] => {
    const history = get(historyAtom);
    const items = getItemsByIds(history.map((entry) => entry.id));
    const byId = new Map(items.map((item) => [item.id, item] as const));
    return history
        .map((entry) => {
            const item = byId.get(entry.id);
            return item ? {entry, item} : null;
        })
        .filter((row): row is HistoryRow => row !== null);
});

/** Rows for "Seguir viendo": started, not finished, most recent first. */
export const continueWatchingAtom = atom<HistoryRow[]>((get): HistoryRow[] =>
    get(historyItemsAtom)
        .filter(({entry}) => {
            if (entry.durationSeconds <= 0) return entry.positionSeconds > 5;
            const progress = entry.positionSeconds / entry.durationSeconds;
            return progress > 0.02 && progress < 0.95;
        })
        .slice(0, 12)
);

/* ---------------------------------- writers ------------------------------- */

export const toggleFavoriteAtom = atom(null, (get, set, id: string) => {
    const current = get(favoriteIdsAtom);
    const next = current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [id, ...current];
    set(favoriteIdsAtom, next);
    return next.includes(id);
});

export const recordWatchAtom = atom(
    null,
    (get, set, entry: Omit<HistoryEntry, "watchedAt">) => {
        const current = get(historyAtom).filter((row) => row.id !== entry.id);
        set(
            historyAtom,
            [{...entry, watchedAt: Date.now()}, ...current].slice(
                0,
                HISTORY_LIMIT
            )
        );
    }
);

export const updateProgressAtom = atom(
    null,
    (
        get,
        set,
        payload: {id: string; positionSeconds: number; durationSeconds?: number}
    ) => {
        const current = get(historyAtom);
        const index = current.findIndex((row) => row.id === payload.id);
        if (index === -1) return;
        const next = [...current];
        next[index] = {
            ...next[index],
            positionSeconds: payload.positionSeconds,
            durationSeconds:
                payload.durationSeconds ?? next[index].durationSeconds,
            watchedAt: Date.now(),
        };
        set(historyAtom, next);
    }
);

export const pushRecentSearchAtom = atom(null, (get, set, term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    const current = get(recentSearchesAtom).filter(
        (row) => row.toLowerCase() !== trimmed.toLowerCase()
    );
    set(
        recentSearchesAtom,
        [trimmed, ...current].slice(0, RECENT_SEARCH_LIMIT)
    );
});

export const clearHistoryAtom = atom(null, (_get, set) => {
    set(historyAtom, []);
});
