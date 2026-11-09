import type {CatalogItem} from "@/models/video";

/** How far ahead of the premiere it counts as "starting any minute". */
export const PREMIERE_LEAD_MINUTES = 10;

const MINUTE_MS = 60_000;

/**
 * How long a premiere whose data still says "upcoming" is treated as live.
 * The published dataset only refreshes every few hours, so right after the
 * scheduled time the app cannot tell "aired" from "late" — and a stale flag
 * must not keep claiming "live" forever.
 */
export const PREMIERE_LIVE_GRACE_MS = 3 * 60 * MINUTE_MS;

/**
 * Where an episode is in its release, as seen from `now`.
 *
 *  - `scheduled` / `imminent`: has a known future start; not playable yet.
 *  - `unknown-time`: announced as upcoming but the dataset has no start time.
 *  - `live`: the start time passed (or it is streaming); playable.
 *  - `released`: an ordinary video.
 */
export type PremiereState =
    | {phase: "released"}
    | {phase: "unknown-time"}
    | {phase: "scheduled" | "imminent"; at: number; remainingMs: number}
    | {phase: "live"; at: number | null};

export type UpcomingPremiere = {item: CatalogItem; state: PremiereState};

const parseTime = (iso: string | undefined): number | null => {
    if (!iso) return null;
    const parsed = Date.parse(iso);
    return Number.isNaN(parsed) ? null : parsed;
};

/** Pure: the clock is always passed in, never read here. */
export const getPremiereState = (
    item: Pick<CatalogItem, "live_status" | "premiere_at">,
    now: number
): PremiereState => {
    const at = parseTime(item.premiere_at);

    if (item.live_status === "live") return {phase: "live", at};

    if (at !== null && at > now) {
        const remainingMs = at - now;
        const imminent = remainingMs <= PREMIERE_LEAD_MINUTES * MINUTE_MS;
        return {phase: imminent ? "imminent" : "scheduled", at, remainingMs};
    }

    if (item.live_status === "upcoming") {
        if (at === null) return {phase: "unknown-time"};
        if (now - at < PREMIERE_LIVE_GRACE_MS) return {phase: "live", at};
    }

    return {phase: "released"};
};

/** Whether the player may be loaded with this episode. */
export const isPlayable = (state: PremiereState): boolean =>
    state.phase === "released" || state.phase === "live";

const sortKey = (state: PremiereState): number => {
    if (state.phase === "unknown-time") return Number.POSITIVE_INFINITY;
    if (state.phase === "released") return Number.NaN;
    return state.at ?? Number.NEGATIVE_INFINITY;
};

/**
 * The next premiere to surface: live ones first, then the soonest scheduled,
 * then ones with no known time. `null` when everything has already aired.
 */
export const getUpcomingPremiere = (
    videos: readonly CatalogItem[],
    now: number
): UpcomingPremiere | null => {
    let best: UpcomingPremiere | null = null;
    let bestKey = Number.POSITIVE_INFINITY;
    for (const item of videos) {
        if (item.kind !== "video") continue;
        const state = getPremiereState(item, now);
        if (state.phase === "released") continue;
        const key = sortKey(state);
        if (best === null || key < bestKey) {
            best = {item, state};
            bestKey = key;
        }
    }
    return best;
};
