const YOUTUBE_ID = /([\w-]{11})/;

const URL_PATTERNS = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
];

/** Pulls the 11 char video id out of any YouTube URL shape we ship. */
export const getYoutubeVideoId = (
    url: string | null | undefined
): string | null => {
    if (!url) return null;
    for (const pattern of URL_PATTERNS) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

/**
 * Thumbnails in the dataset carry signed query params that expire. Building the
 * URL from the id instead keeps covers loading months after a dataset refresh.
 */
export const thumbnailUrl = (
    id: string,
    quality: "default" | "mq" | "hq" | "sd" | "max" = "hq"
): string => {
    const suffix = {
        default: "default",
        mq: "mqdefault",
        hq: "hqdefault",
        sd: "sddefault",
        max: "maxresdefault",
    }[quality];
    return `https://i.ytimg.com/vi/${id}/${suffix}.jpg`;
};

export const watchUrl = (
    id: string,
    kind: "video" | "short" = "video"
): string =>
    kind === "short"
        ? `https://www.youtube.com/shorts/${id}`
        : `https://www.youtube.com/watch?v=${id}`;

export const isValidVideoId = (id: string | null | undefined): id is string =>
    !!id && id.length === 11 && YOUTUBE_ID.test(id);
