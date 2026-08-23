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

    /*
     * Derived by `scripts/update-videos-list.js`. All optional: the fields are
     * only written when the parser is confident, and older datasets predate
     * them entirely, so every reader needs a fallback.
     */

    /** The episode name without brand, season or SHOUTING. */
    title_clean?: string;
    /** Display label, e.g. "Duodécima Temporada" or "CoronaTour". */
    season?: string;
    /** 1-14 when the season is a numbered one. */
    season_number?: number;
    /** Chip label, e.g. "T12", "BONUS", "TOUR". */
    season_short?: string;
    /** Only present for the spin-offs (CoronaTour, Dibujando Huevadas, ...). */
    series?: string;
    episode_number?: number;
    /** Hashtags scraped off a short's title. */
    hashtags?: string[];
    like_count?: number;
    /** Likes per view. The only quality signal available without an API key. */
    like_ratio?: number;
    /** YYYY-MM-DD. */
    upload_date?: string;
    /** ISO timestamp of the last stats fetch. */
    stats_checked_at?: string;
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
