import {atom} from "jotai";
import {STORAGE_ID} from "@/constants/storage";
import type {CatalogItem, HistoryEntry, StreakState} from "@/models/video";
import {
    getItemsByIds,
    getShorts,
    getShuffledShorts,
    getVideos,
} from "@/services/catalog";
import {
    createSalt,
    INITIAL_NOTIFICATION_STATE,
    type NotificationLevel,
    type NotificationSlot,
    type NotificationState,
    registerOpen,
} from "@/services/notificationPlanner";
import {favoriteRails, type Rail} from "@/services/recommendations";
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
/** Unshuffled shorts, for anything that needs the catalog order (the planner). */
export const shortsCatalogAtom = atom<CatalogItem[]>((): CatalogItem[] =>
    getShorts()
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

/** What the OS last told us about the notification permission. */
export type PermissionState = "unknown" | "granted" | "denied";

/**
 * Live permission status, in memory only. The OS is the source of truth and it
 * can change from outside the app, so this is re-read on every launch rather
 * than persisted.
 */
export const notificationPermissionAtom = atom<PermissionState>("unknown");

export type Settings = {
    /**
     * Whether this user wants to hear from us. On by default: an app nobody
     * hears from is an app nobody opens, and the OS permission below is the
     * real gate anyway — this flag only decides what happens once it is granted.
     */
    dailyNotification: boolean;
    /**
     * Set only when the user turns notifications off by hand.
     *
     * Without it, "false" is ambiguous — it means both "never asked" and "asked
     * and refused" — and the launch check that adopts an existing OS grant
     * would happily switch someone back on after they deliberately switched
     * themselves off.
     */
    notificationOptOut: boolean;
    /** 0-23 local hour that anchors the primetime slot. */
    reminderHour: number;
    /** How many pushes a day the user is willing to take. */
    notificationLevel: NotificationLevel;
    autoplay: boolean;
    reduceMotion: boolean;
};

export const settingsAtom = persistedAtom<Settings>(STORAGE_ID.settings, {
    dailyNotification: true,
    notificationOptOut: false,
    reminderHour: 19,
    notificationLevel: "normal",
    autoplay: true,
    reduceMotion: false,
});

/**
 * Everything the planner has to remember between launches: which clips were
 * already pushed, which hours this user answers, and how long they have been
 * ignoring us.
 */
export const notificationStateAtom = persistedAtom<NotificationState>(
    STORAGE_ID.notifications,
    INITIAL_NOTIFICATION_STATE
);

/** Lazily seeds the per-install jitter salt on first use. */
export const ensureNotificationSaltAtom = atom(null, (get, set) => {
    const current = get(notificationStateAtom);
    if (current.salt) return current;
    const next = {...current, salt: createSalt()};
    set(notificationStateAtom, next);
    return next;
});

export const recordNotificationOpenAtom = atom(
    null,
    (get, set, slot: NotificationSlot | undefined) => {
        set(
            notificationStateAtom,
            registerOpen(get(notificationStateAtom), slot)
        );
    }
);

export type Engagement = {
    /** Number of app opens, used to time the permission and share prompts. */
    sessions: number;
    /** When the notification card was last shown, so it can rest between asks. */
    notificationPromptAt?: number | null;
    /** How many times it has been shown. Capped — three noes is an answer. */
    notificationPromptCount?: number;
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

/**
 * Resume progress by id, quantised to 5% buckets.
 *
 * `updateProgressAtom` fires every second while something plays. Handing the
 * lists a brand new Map on every tick re-renders every card on screen once a
 * second for a bar that moves one pixel. Bucketing means the identity only
 * changes when the bar visibly moves.
 */
const progressSignature = (entries: HistoryEntry[]): string =>
    entries
        .map((entry) =>
            entry.durationSeconds > 0
                ? `${entry.id}:${Math.round((entry.positionSeconds / entry.durationSeconds) * 20)}`
                : entry.id
        )
        .join(",");

let progressCache: {signature: string; map: Map<string, number>} | null = null;

export const watchProgressAtom = atom<Map<string, number>>((get) => {
    const history = get(historyAtom);
    const signature = progressSignature(history);
    if (progressCache?.signature === signature) return progressCache.map;

    const map = new Map<string, number>();
    for (const entry of history) {
        if (entry.durationSeconds > 0) {
            map.set(entry.id, entry.positionSeconds / entry.durationSeconds);
        }
    }
    progressCache = {signature, map};
    return map;
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

/* ------------------------------ recommendations --------------------------- */

/*
 * Comes out of the same engine as Inicio's own rails
 * (`services/recommendations.ts`), which is memoised on the ids — not on the
 * playback positions — so a video playing does not rebuild eight carousels
 * once a second.
 */

export const favoriteRailsAtom = atom<Rail[]>((get): Rail[] =>
    favoriteRails({
        videos: get(videosAtom),
        shorts: get(shortsCatalogAtom),
        history: get(historyAtom),
        favoriteIds: get(favoriteIdsAtom),
        favorites: get(favoriteItemsAtom),
    })
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
