import type {CatalogItem, HistoryEntry} from "@/models/video";
import {
    INITIAL_NOTIFICATION_STATE,
    type NotificationState,
    nextStateAfterPlan,
    type PlannerInput,
    planNotifications,
    pushesPerDay,
    registerOpen,
} from "@/services/notificationPlanner";
import {dayKey} from "@/utils/date";

const video = (
    id: string,
    overrides: Partial<CatalogItem> = {}
): CatalogItem => ({
    id,
    link: `https://www.youtube.com/watch?v=${id}`,
    title: `HABLANDO HUEVADAS - Décima Temporada [${id.toUpperCase()}]`,
    title_clean: `Episodio ${id}`,
    season: "Décima Temporada",
    season_number: 10,
    season_short: "T10",
    view_count: 1_000_000,
    thumbnail: null,
    kind: "video",
    ...overrides,
});

const short = (id: string): CatalogItem => ({
    ...video(id),
    kind: "short",
    title: `Short ${id} #hablandohuevadas`,
    title_clean: `Short ${id}`,
    season: undefined,
    season_short: undefined,
});

const videos = Array.from({length: 40}, (_, index) => video(`v${index}`));
const shorts = Array.from({length: 40}, (_, index) => short(`s${index}`));

/** Monday 09:00 local — before every slot except morning. */
const NOW = new Date("2026-03-02T09:00:00");

const baseInput = (overrides: Partial<PlannerInput> = {}): PlannerInput => ({
    now: NOW,
    level: "normal",
    reminderHour: 21,
    videos,
    shorts,
    history: [],
    favoriteIds: [],
    streak: {current: 0, best: 0, lastDay: dayKey(NOW), totalDays: 1},
    state: {...INITIAL_NOTIFICATION_STATE, salt: "test"},
    ...overrides,
});

const watched = (id: string, progress: number): HistoryEntry => ({
    id,
    kind: "video",
    watchedAt: NOW.getTime() - 3_600_000,
    positionSeconds: 600 * progress,
    durationSeconds: 600,
});

describe("planNotifications", () => {
    it("schedules the level's budget per day across the horizon", () => {
        const plan = planNotifications(baseInput({horizonDays: 2}));
        const byDay = new Map<string, number>();
        for (const entry of plan) {
            const key = dayKey(new Date(entry.fireAt));
            byDay.set(key, (byDay.get(key) ?? 0) + 1);
        }
        // Day one only counts the slots that have not passed yet.
        expect(plan.length).toBeGreaterThan(0);
        for (const count of byDay.values()) {
            expect(count).toBeLessThanOrEqual(pushesPerDay("normal"));
        }
    });

    it("gives chill one push a day and hardcore five", () => {
        const chill = planNotifications(
            baseInput({level: "chill", horizonDays: 1})
        );
        const hardcore = planNotifications(
            baseInput({level: "hardcore", horizonDays: 1})
        );
        expect(chill.length).toBe(1);
        expect(hardcore.length).toBeGreaterThan(chill.length);
    });

    it("never repeats a clip inside one plan", () => {
        const plan = planNotifications(baseInput({level: "hardcore"}));
        const ids = plan
            .map((entry) => entry.data.videoId)
            .filter((id): id is string => Boolean(id));
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("never fires during quiet hours", () => {
        const plan = planNotifications(baseInput({level: "hardcore"}));
        for (const entry of plan) {
            const hour = new Date(entry.fireAt).getHours();
            expect(hour).toBeGreaterThanOrEqual(7);
        }
    });

    it("never schedules a time that has already passed", () => {
        const plan = planNotifications(baseInput());
        for (const entry of plan) {
            expect(entry.fireAt).toBeGreaterThan(NOW.getTime());
        }
    });

    it("anchors a slot to the hour the user picked", () => {
        const plan = planNotifications(baseInput({reminderHour: 15}));
        const primetime = plan.find((entry) => entry.slot === "primetime");
        expect(primetime).toBeDefined();
        expect(new Date(primetime?.fireAt ?? 0).getHours()).toBe(15);
    });

    it("skips clips that were already pushed recently", () => {
        const state: NotificationState = {
            ...INITIAL_NOTIFICATION_STATE,
            salt: "test",
            recentIds: videos.slice(0, 20).map((item) => item.id),
        };
        const plan = planNotifications(baseInput({state, level: "hardcore"}));
        const pushed = plan
            .map((entry) => entry.data.videoId)
            .filter((id): id is string => Boolean(id));
        for (const id of pushed) {
            expect(state.recentIds).not.toContain(id);
        }
    });

    it("nudges an unfinished episode instead of a random one", () => {
        const plan = planNotifications(
            baseInput({history: [watched("v7", 0.4)], level: "hardcore"})
        );
        const resume = plan.find((entry) => entry.intent === "resume");
        expect(resume?.data.videoId).toBe("v7");
    });

    it("chases the streak when the user has not opened today", () => {
        const plan = planNotifications(
            baseInput({
                streak: {
                    current: 5,
                    best: 5,
                    lastDay: "2026-03-01",
                    totalDays: 5,
                },
                level: "hardcore",
            })
        );
        const streak = plan.find((entry) => entry.intent === "streak");
        expect(streak).toBeDefined();
        expect(streak?.body).toContain("5");
    });

    it("switches to win-back copy after three silent days", () => {
        const plan = planNotifications(
            baseInput({
                state: {
                    ...INITIAL_NOTIFICATION_STATE,
                    salt: "test",
                    lastOpenedAt: NOW.getTime() - 5 * 86_400_000,
                },
            })
        );
        expect(plan.some((entry) => entry.intent === "comeback")).toBe(true);
    });

    it("backs off when the user keeps ignoring the pushes", () => {
        const loud = planNotifications(
            baseInput({level: "hardcore", horizonDays: 1})
        );
        const quiet = planNotifications(
            baseInput({
                level: "hardcore",
                horizonDays: 1,
                state: {
                    ...INITIAL_NOTIFICATION_STATE,
                    salt: "test",
                    quietDays: 8,
                },
            })
        );
        expect(quiet.length).toBe(1);
        expect(quiet.length).toBeLessThan(loud.length);
    });

    it("sends shorts to the short slots and episodes to primetime", () => {
        const plan = planNotifications(baseInput({level: "hardcore"}));
        const shortIds = new Set(shorts.map((item) => item.id));
        for (const entry of plan) {
            if (entry.intent !== "short" || !entry.data.videoId) continue;
            expect(shortIds.has(entry.data.videoId)).toBe(true);
        }
    });

    it("carries a video id and a slot so the tap can route and be scored", () => {
        const plan = planNotifications(baseInput());
        const withVideo = plan.filter((entry) => entry.data.videoId);
        expect(withVideo.length).toBeGreaterThan(0);
        for (const entry of withVideo) {
            expect(entry.data.slot).toBeTruthy();
            expect(entry.title).toBeTruthy();
            expect(entry.body).toBeTruthy();
        }
    });

    it("produces stable ids so re-planning replaces instead of duplicating", () => {
        const first = planNotifications(baseInput());
        const second = planNotifications(baseInput());
        expect(first.map((entry) => entry.id)).toEqual(
            second.map((entry) => entry.id)
        );
    });

    it("returns nothing when the catalog is empty", () => {
        expect(planNotifications(baseInput({videos: [], shorts: []}))).toEqual(
            []
        );
    });
});

describe("notification state", () => {
    it("remembers the pushed clips inside the fatigue window", () => {
        const input = baseInput();
        const plan = planNotifications(input);
        const next = nextStateAfterPlan(input, plan);
        const pushed = plan
            .map((entry) => entry.data.videoId)
            .filter((id): id is string => Boolean(id));
        for (const id of pushed) expect(next.recentIds).toContain(id);
        expect(next.lastPlanDay).toBe(dayKey(NOW));
    });

    it("counts a quiet day only when a previous plan went unanswered", () => {
        const input = baseInput({
            state: {
                ...INITIAL_NOTIFICATION_STATE,
                salt: "test",
                lastPlanDay: "2026-03-01",
                quietDays: 1,
            },
        });
        expect(nextStateAfterPlan(input, []).quietDays).toBe(2);
    });

    it("resets the back-off when the user tapped since the last plan", () => {
        const input = baseInput({
            state: {
                ...INITIAL_NOTIFICATION_STATE,
                salt: "test",
                lastPlanDay: "2026-03-01",
                quietDays: 3,
                lastOpenedAt: new Date("2026-03-01T22:00:00").getTime(),
            },
        });
        expect(nextStateAfterPlan(input, []).quietDays).toBe(0);
    });

    it("scores the slot that produced the tap", () => {
        const state = registerOpen(
            {...INITIAL_NOTIFICATION_STATE, quietDays: 4},
            "lunch",
            1000
        );
        expect(state.slotHits.lunch).toBe(1);
        expect(state.quietDays).toBe(0);
        expect(state.lastOpenedAt).toBe(1000);
    });

    it("drifts the schedule towards the slot the user answers", () => {
        const plan = planNotifications(
            baseInput({
                level: "chill",
                horizonDays: 1,
                state: {
                    ...INITIAL_NOTIFICATION_STATE,
                    salt: "test",
                    slotHits: {lunch: 9},
                },
            })
        );
        // Primetime is always kept, so a one-push budget still lands there;
        // the learned slot has to win the second seat.
        const two = planNotifications(
            baseInput({
                level: "normal",
                horizonDays: 1,
                state: {
                    ...INITIAL_NOTIFICATION_STATE,
                    salt: "test",
                    slotHits: {lunch: 9},
                },
            })
        );
        expect(plan[0].slot).toBe("primetime");
        expect(two.map((entry) => entry.slot)).toContain("lunch");
    });
});

describe("premiere notifications", () => {
    const premiere = video("premiere1", {
        announced_at: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
        premiere_at: new Date(NOW.getTime() + 2 * 3_600_000).toISOString(),
    });
    const withPremiere = [...videos, premiere];

    it("schedules a starting-soon push exactly 10 minutes before the premiere and a live push exactly at it", () => {
        const plan = planNotifications(
            baseInput({videos: withPremiere, horizonDays: 1})
        );
        const soon = plan.find((entry) => entry.intent === "premiere_soon");
        const live = plan.find((entry) => entry.intent === "premiere_live");
        const premiereAt = Date.parse(premiere.premiere_at ?? "");

        expect(soon?.fireAt).toBe(premiereAt - 10 * 60_000);
        expect(live?.fireAt).toBe(premiereAt);
        expect(soon?.data.videoId).toBe("premiere1");
        expect(live?.data.videoId).toBe("premiere1");
        // Exact-clock pushes don't belong to a ranked daily slot.
        expect(soon?.slot).toBeUndefined();
    });

    it("claims a daily slot to announce the premiere ahead of the generic daily pick", () => {
        const plan = planNotifications(
            baseInput({videos: withPremiere, horizonDays: 1})
        );
        const announced = plan.find(
            (entry) => entry.intent === "premiere_announced"
        );
        expect(announced?.data.videoId).toBe("premiere1");
    });

    it("stops pushing about a premiere once the user has watched it", () => {
        const plan = planNotifications(
            baseInput({
                videos: withPremiere,
                horizonDays: 1,
                history: [watched("premiere1", 1)],
            })
        );
        expect(plan.some((entry) => entry.data.videoId === "premiere1")).toBe(
            false
        );
    });

    it("keeps announcing an aired-but-unwatched premiere for the follow-up window, without clock pushes for the past", () => {
        const aired = video("premiere2", {
            announced_at: new Date(
                NOW.getTime() - 4 * 86_400_000
            ).toISOString(),
            premiere_at: new Date(NOW.getTime() - 86_400_000).toISOString(),
        });
        const plan = planNotifications(
            baseInput({videos: [...videos, aired], horizonDays: 1})
        );
        expect(
            plan.some(
                (entry) =>
                    entry.intent === "premiere_announced" &&
                    entry.data.videoId === "premiere2"
            )
        ).toBe(true);
        expect(
            plan.some(
                (entry) =>
                    (entry.intent === "premiere_soon" ||
                        entry.intent === "premiere_live") &&
                    entry.data.videoId === "premiere2"
            )
        ).toBe(false);
    });

    it("keeps re-announcing the same premiere across every day of the horizon", () => {
        const plan = planNotifications(
            baseInput({videos: withPremiere, horizonDays: 3})
        );
        const announcedDays = new Set(
            plan
                .filter((entry) => entry.intent === "premiere_announced")
                .map((entry) => dayKey(new Date(entry.fireAt)))
        );
        expect(announcedDays.size).toBeGreaterThan(1);
    });
});
