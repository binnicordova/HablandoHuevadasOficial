/**
 * The publisher runs on Sunday night, but the app does not trust a calendar: a
 * late or retried publish must still reach users the same day. A conditional
 * GET answers 304 for free, so asking every few hours is cheaper than being
 * wrong for a week.
 */
export const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const isRefreshDue = (
    now: number,
    lastCheckedAt: number | null
): boolean => lastCheckedAt === null || now - lastCheckedAt >= SYNC_INTERVAL_MS;
