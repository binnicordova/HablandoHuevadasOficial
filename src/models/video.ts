export type VideoKind = "video" | "short";

export type Video = {
    id: string;
    link: string;
    title: string;
    description?: string | null;
    duration?: number;
    duration_string?: string;
    view_count: number | null;
    thumbnail: string | null;
    thumbnails?: {url: string; height: number; width: number}[] | null;
    channel?: string | null;
    channel_id?: string | null;
    uploader?: string | null;
    uploader_id?: string | null;
};

/** A catalog entry enriched with the collection it belongs to. */
export type CatalogItem = Video & {kind: VideoKind};

/** One row of "seguir viendo": what the user watched and how far they got. */
export type HistoryEntry = {
    id: string;
    kind: VideoKind;
    /** Epoch ms of the last time this item was opened. */
    watchedAt: number;
    /** Seconds already played, used to resume. */
    positionSeconds: number;
    /** Total duration in seconds when known, so we can render a progress bar. */
    durationSeconds: number;
};

export type StreakState = {
    /** Consecutive days with at least one open. */
    current: number;
    /** Best streak ever reached, kept as a bragging/share hook. */
    best: number;
    /** YYYY-MM-DD of the last day the streak was credited. */
    lastDay: string | null;
    /** Total distinct days opened, used for milestone rewards. */
    totalDays: number;
};
