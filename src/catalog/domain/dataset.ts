import type {Video} from "@/models/video";

export type RawDataset = {
    channel: string;
    videos: Video[];
    shorts: Video[];
};

export const datasetSize = (dataset: RawDataset): number =>
    dataset.videos.length + dataset.shorts.length;

const isVideoShaped = (value: unknown): value is Video => {
    if (typeof value !== "object" || value === null) return false;
    const {id, title} = value as Record<string, unknown>;
    return (
        typeof id === "string" &&
        id.length > 0 &&
        typeof title === "string" &&
        title.length > 0
    );
};

/**
 * Narrows untrusted JSON to a dataset the app can render, or throws. Every
 * item is checked, not a sample: one bad record crashing a list is worse than
 * rejecting a download and staying on the data we already have.
 */
export const parseDataset = (text: string): RawDataset => {
    const data = JSON.parse(text) as Partial<RawDataset> | null;
    if (
        !data ||
        typeof data.channel !== "string" ||
        !Array.isArray(data.videos) ||
        !Array.isArray(data.shorts)
    ) {
        throw new Error("Dataset is missing channel, videos or shorts");
    }
    if (
        !data.videos.every(isVideoShaped) ||
        !data.shorts.every(isVideoShaped)
    ) {
        throw new Error("Dataset contains a malformed item");
    }
    const dataset: RawDataset = {
        channel: data.channel,
        videos: data.videos,
        shorts: data.shorts,
    };
    if (datasetSize(dataset) === 0) throw new Error("Dataset is empty");
    return dataset;
};

/** A new release may not shrink to less than half of what we hold: that is a
 *  broken publish, not a channel that deleted half its videos. */
export const MIN_RETAINED_RATIO = 0.5;

export const isPlausibleReplacement = (
    current: RawDataset,
    next: RawDataset
): boolean => datasetSize(next) >= datasetSize(current) * MIN_RETAINED_RATIO;
