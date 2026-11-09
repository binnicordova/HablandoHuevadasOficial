export type Countdown = {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    /** Whole seconds left, rounded up so it never reads 0 before the start. */
    totalSeconds: number;
};

const SECOND_MS = 1000;

export const toCountdown = (remainingMs: number): Countdown => {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / SECOND_MS));
    return {
        days: Math.floor(totalSeconds / 86_400),
        hours: Math.floor((totalSeconds % 86_400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        totalSeconds,
    };
};

/** Seconds only show once the last ten minutes begin. */
const SECONDS_BELOW = 10 * 60;

/**
 * Compact, language-neutral label: `2d 3h`, `1h 52m`, `42m`, `9m 41s`.
 * The text only changes once a minute until the final stretch, which is what
 * lets a subscriber re-render that rarely.
 */
export const formatCountdown = ({
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
}: Countdown): string => {
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (totalSeconds <= SECONDS_BELOW) {
        return `${minutes}m ${`${seconds}`.padStart(2, "0")}s`;
    }
    return `${minutes}m`;
};
