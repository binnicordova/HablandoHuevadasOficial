import {COPY} from "@/constants/copy";
import {
    type Countdown,
    formatCountdown,
    toCountdown,
} from "@/premiere/domain/countdown";
import type {UpcomingPremiere} from "@/premiere/domain/premiere";

/**
 * What the fire button needs, as primitives only — so two snapshots of the
 * same minute compare equal and the button does not re-render on every tick.
 */
export type PremiereView = {
    id: string;
    phase: "scheduled" | "imminent" | "live" | "unknown-time";
    /** The pill text. */
    label: string;
    a11yLabel: string;
    /** "8 de noviembre a las 21:00", or null when the start is unknown. */
    whenLabel: string | null;
};

const LOCALE = "es-PE";

const spoken = ({days, hours, minutes, seconds, totalSeconds}: Countdown) => {
    const {spokenDays, spokenHours, spokenMinutes, spokenSeconds} =
        COPY.premiere;
    if (days > 0) return `${spokenDays(days)} ${spokenHours(hours)}`;
    if (hours > 0) return `${spokenHours(hours)} ${spokenMinutes(minutes)}`;
    if (totalSeconds <= 60) return spokenSeconds(totalSeconds);
    return seconds > 0 && totalSeconds <= 600
        ? `${spokenMinutes(minutes)} ${spokenSeconds(seconds)}`
        : spokenMinutes(minutes);
};

/** Device-local date and time. Falls back to ISO if `Intl` lacks the locale. */
export const formatPremiereWhen = (at: number): string => {
    const date = new Date(at);
    try {
        const day = date.toLocaleDateString(LOCALE, {
            day: "numeric",
            month: "long",
        });
        const time = date.toLocaleTimeString(LOCALE, {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
        return COPY.premiere.whenAt(day, time);
    } catch {
        return date.toISOString();
    }
};

export const toPremiereView = (
    upcoming: UpcomingPremiere | null
): PremiereView | null => {
    if (!upcoming) return null;
    const {item, state} = upcoming;

    switch (state.phase) {
        case "released":
            return null;
        case "unknown-time":
            return {
                id: item.id,
                phase: "unknown-time",
                label: COPY.premiere.soon,
                a11yLabel: COPY.premiere.a11ySoon,
                whenLabel: null,
            };
        case "live":
            return {
                id: item.id,
                phase: "live",
                label: COPY.premiere.goLive,
                a11yLabel: COPY.premiere.a11yLive,
                whenLabel:
                    state.at === null ? null : formatPremiereWhen(state.at),
            };
        default: {
            const countdown = toCountdown(state.remainingMs);
            return {
                id: item.id,
                phase: state.phase,
                label: formatCountdown(countdown),
                a11yLabel: COPY.premiere.a11yCountdown(spoken(countdown)),
                whenLabel: formatPremiereWhen(state.at),
            };
        }
    }
};

export const samePremiereView = (
    a: PremiereView | null,
    b: PremiereView | null
): boolean =>
    a === b ||
    (a !== null &&
        b !== null &&
        a.id === b.id &&
        a.phase === b.phase &&
        a.label === b.label &&
        a.a11yLabel === b.a11yLabel &&
        a.whenLabel === b.whenLabel);

/** Announced, but the player must not load it yet. */
export const isPremiereLocked = (
    view: PremiereView | null
): view is PremiereView => view !== null && view.phase !== "live";
