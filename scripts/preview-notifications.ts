/**
 * Prints the notification plan the app would schedule right now, against the
 * real bundled catalog.
 *
 * The planner is pure, so this is the same code path the device runs — no
 * mocks, no fixtures. Use it to sanity-check copy, slot spread and content
 * picks before shipping a change to the strategy.
 *
 *   bun run scripts/preview-notifications.ts
 *   bun run scripts/preview-notifications.ts hardcore
 *   bun run scripts/preview-notifications.ts chill 15
 */

import type {HistoryEntry} from "../src/models/video";
import {getShorts, getVideos} from "../src/services/catalog";
import {
    INITIAL_NOTIFICATION_STATE,
    type NotificationLevel,
    planNotifications,
    pushesPerDay,
} from "../src/services/notificationPlanner";

const level = (process.argv[2] as NotificationLevel) ?? "normal";
const reminderHour = Number(process.argv[3] ?? 21);

const videos = getVideos();
const shorts = getShorts();

// A plausible returning user: three episodes watched, one left at 40%, two
// favourites from the same season. Enough state to exercise every intent.
const history: HistoryEntry[] = [
    {
        id: videos[12].id,
        kind: "video",
        watchedAt: Date.now() - 3_600_000,
        positionSeconds: 1200,
        durationSeconds: 3000,
    },
    {
        id: videos[30].id,
        kind: "video",
        watchedAt: Date.now() - 90_000_000,
        positionSeconds: 3000,
        durationSeconds: 3000,
    },
];

const plan = planNotifications({
    now: new Date(),
    level,
    reminderHour,
    videos,
    shorts,
    history,
    favoriteIds: [videos[45].id, videos[46].id, videos[47].id],
    streak: {current: 4, best: 9, lastDay: "2020-01-01", totalDays: 22},
    state: {...INITIAL_NOTIFICATION_STATE, salt: "preview"},
});

const time = (at: number) =>
    new Date(at).toLocaleString("es-PE", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
    });

console.log(
    `\nLevel "${level}" · up to ${pushesPerDay(level)}/day · primetime anchored at ${reminderHour}:00`
);
console.log(`${plan.length} notifications scheduled over the next 3 days\n`);

for (const entry of plan) {
    console.log(
        `${time(entry.fireAt).padEnd(18)} ${entry.slot.padEnd(10)} ${entry.intent.padEnd(10)}`
    );
    console.log(`   ${entry.title}`);
    console.log(`   ${entry.body}\n`);
}
