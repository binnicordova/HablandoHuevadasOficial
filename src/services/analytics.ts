import {STORAGE_ID} from "@/constants/storage";
import {storage} from "@/utils/storage";

/**
 * Every growth change in this app is a hypothesis, and none of them can be
 * judged without events. This is a deliberately small seam: it buffers events
 * locally and exposes `setAnalyticsSink` so a real provider (PostHog, Amplitude,
 * Firebase) can be dropped in later without touching a single call site.
 *
 * Nothing leaves the device until a sink is installed.
 */

export type AnalyticsEvent =
    | {name: "app_open"; sessions: number}
    | {name: "play_start"; videoId: string; kind: string; surface: string}
    | {name: "play_progress"; videoId: string; percent: number}
    | {name: "search"; termLength: number; results: number}
    | {name: "favorite_add"; videoId: string}
    | {name: "favorite_remove"; videoId: string}
    | {name: "share"; videoId: string; channel: string; surface: string}
    | {name: "notification_prompt_shown"}
    | {name: "notification_opt_in"; granted: boolean}
    | {name: "notification_opened"; intent: string}
    | {name: "streak_day"; streak: number};

export type AnalyticsRecord = AnalyticsEvent & {at: number};

type Sink = (event: AnalyticsRecord) => void;

const BUFFER_LIMIT = 200;

let sink: Sink | null = null;
let buffer: AnalyticsRecord[] = [];

/** Install a real provider. Any events buffered before this point are flushed. */
export const setAnalyticsSink = (next: Sink | null) => {
    sink = next;
    if (!sink) return;
    for (const record of buffer) sink(record);
    buffer = [];
};

export const track = (event: AnalyticsEvent) => {
    const record: AnalyticsRecord = {...event, at: Date.now()};
    if (sink) {
        sink(record);
        return;
    }
    buffer = [...buffer, record].slice(-BUFFER_LIMIT);
};

/** Exposed for debugging and for a future "export my data" screen. */
export const getBufferedEvents = (): AnalyticsRecord[] => [...buffer];

export const persistBuffer = async () => {
    await storage.setItem(`${STORAGE_ID.engagement}.events`, buffer);
};
