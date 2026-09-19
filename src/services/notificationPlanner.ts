import {COPY} from "@/constants/copy";
import type {
    CatalogItem,
    HistoryEntry,
    StreakState,
    VideoKind,
} from "@/models/video";
import {popularity} from "@/services/catalog";
import {
    affinityScore,
    buildTaste,
    type Taste,
    topSeasons,
} from "@/services/taste";
import {dayKey, hashString} from "@/utils/date";
import {displayTitle} from "@/utils/format";

/**
 * The notification brain.
 *
 * One local push a day is a newsletter. Five random ones a day is a reason to
 * revoke the permission. What actually earns the re-open is *relevance per
 * slot*: the right kind of clip, at an hour this user has already proven they
 * answer, with the app backing off the moment it stops working.
 *
 * Everything here is pure — no expo, no storage, no clock beyond the `now` it
 * is handed — so the whole strategy is unit-testable and cheap to re-run on
 * every launch. `utils/notification.ts` is the only part that talks to the OS.
 *
 * The loop:
 *   1. budget       how many pushes today (level, minus back-off)
 *   2. slots        which hours, ranked by this user's own open history
 *   3. intents      what each slot is *for* (streak at risk? unfinished clip?)
 *   4. content      score the catalog per slot: quality, novelty, taste, fatigue
 *   5. copy         a voice variant picked deterministically, so it rotates
 */

export type NotificationLevel = "chill" | "normal" | "hardcore";

export type NotificationSlot =
    | "morning"
    | "lunch"
    | "commute"
    | "primetime"
    | "latenight";

export type NotificationIntent =
    | "daily"
    | "resume"
    | "discovery"
    | "short"
    | "streak"
    | "comeback"
    | "favorite"
    | "milestone";

export type PlannedNotification = {
    /** Stable per day+slot, so re-planning replaces instead of duplicating. */
    id: string;
    slot: NotificationSlot;
    intent: NotificationIntent;
    /** Epoch ms. */
    fireAt: number;
    title: string;
    body: string;
    data: {
        intent: NotificationIntent;
        slot: NotificationSlot;
        videoId?: string;
        kind?: VideoKind;
    };
};

export type NotificationState = {
    /** Ids already pushed recently, newest first. Prevents repeat clips. */
    recentIds: string[];
    /** Day key of the last plan, used to age the back-off counter. */
    lastPlanDay: string | null;
    /** Epoch ms of the last notification the user actually tapped. */
    lastOpenedAt: number | null;
    /** Planned days in a row that produced no open. Drives the back-off. */
    quietDays: number;
    /** Opens per slot. The schedule drifts towards the hours that work. */
    slotHits: Partial<Record<NotificationSlot, number>>;
    /** Per-install jitter seed, so two phones never buzz on the same second. */
    salt: string;
};

export const INITIAL_NOTIFICATION_STATE: NotificationState = {
    recentIds: [],
    lastPlanDay: null,
    lastOpenedAt: null,
    quietDays: 0,
    slotHits: {},
    salt: "",
};

export type PlannerInput = {
    now: Date;
    level: NotificationLevel;
    /** The hour the user picked in "Mi zona". Anchors the primetime slot. */
    reminderHour: number;
    videos: CatalogItem[];
    shorts: CatalogItem[];
    history: HistoryEntry[];
    favoriteIds: string[];
    streak: StreakState;
    state: NotificationState;
    /** Days to schedule ahead. iOS drops anything past 64 pending. */
    horizonDays?: number;
};

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** Pushes per day at each level, before back-off. */
const BUDGET: Record<NotificationLevel, number> = {
    chill: 1,
    normal: 3,
    hardcore: 5,
};

/** iOS keeps 64 pending notifications; leave room for anything else. */
const MAX_SCHEDULED = 48;

/** How many past picks are blocked from reappearing. */
const FATIGUE_WINDOW = 40;

/** Base local time per slot, before jitter. */
const SLOT_TIMES: Record<NotificationSlot, {hour: number; minute: number}> = {
    morning: {hour: 8, minute: 20},
    lunch: {hour: 13, minute: 10},
    commute: {hour: 18, minute: 40},
    primetime: {hour: 21, minute: 15},
    latenight: {hour: 22, minute: 45},
};

/**
 * Fallback ranking when we have no opens to learn from. Night first: this is a
 * comedy show people watch in bed, and the lunch break is the other window
 * where a 40 minute episode is a realistic ask.
 */
const SLOT_PRIORITY: NotificationSlot[] = [
    "primetime",
    "latenight",
    "lunch",
    "commute",
    "morning",
];

/** Nothing fires between these hours, whatever the plan says. */
const QUIET_FROM = 0;
const QUIET_UNTIL = 7;

/* ------------------------------- taste profile ---------------------------- */

/**
 * The profile is shared with the home and favourites rails — see
 * `services/taste.ts`. The only planner-specific part is the fatigue window:
 * clips pushed recently are excluded from every pick.
 */
const tasteFor = (input: PlannerInput): Taste =>
    buildTaste({
        videos: input.videos,
        shorts: input.shorts,
        history: input.history,
        favoriteIds: input.favoriteIds,
        excludeIds: input.state.recentIds.slice(0, FATIGUE_WINDOW),
    });

/* --------------------------------- scoring -------------------------------- */

type ScoreContext = {
    taste: Taste;
    /** Highest popularity in the pool, for normalisation. */
    ceiling: number;
    seed: string;
};

/**
 * One item's fitness for one push.
 *
 * The weights are the growth thesis in numbers: quality and novelty carry the
 * pick, taste breaks ties, and a clip we already pushed is effectively banned.
 */
const scoreItem = (
    item: CatalogItem,
    index: number,
    poolSize: number,
    ctx: ScoreContext
): number => {
    if (ctx.taste.recent.has(item.id)) return -1;

    const quality = ctx.ceiling > 0 ? popularity(item) / ctx.ceiling : 0;
    // The dataset is newest first, so position is a recency proxy.
    const freshness = 1 - index / Math.max(poolSize, 1);
    const novelty = ctx.taste.watched.has(item.id) ? 0.05 : 1;
    const affinity = affinityScore(item, ctx.taste);
    // A stable per-day wobble: two users with identical state still get
    // different clips, and the same user sees a different one tomorrow.
    const wobble = (hashString(`${ctx.seed}-${item.id}`) % 100) / 1000;

    return (
        Math.sqrt(quality) * 0.34 +
        freshness * 0.2 +
        novelty * 0.26 +
        affinity * 0.2 +
        wobble
    );
};

const pickBest = (
    pool: CatalogItem[],
    ctx: ScoreContext,
    taken: Set<string>
): CatalogItem | null => {
    let best: CatalogItem | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < pool.length; index++) {
        const item = pool[index];
        if (taken.has(item.id)) continue;
        const score = scoreItem(item, index, pool.length, ctx);
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }

    return best;
};

/* ---------------------------------- slots --------------------------------- */

const slotTime = (
    slot: NotificationSlot,
    day: Date,
    input: PlannerInput
): Date => {
    const base = SLOT_TIMES[slot];
    const hour = slot === "primetime" ? input.reminderHour : base.hour;
    const date = new Date(day);
    // ±11 minutes, stable per install and day. A notification that lands at
    // exactly 21:00:00 every single day reads as a robot and gets muted.
    const jitter =
        (hashString(`${input.state.salt}-${dayKey(day)}-${slot}`) % 23) - 11;
    date.setHours(hour, base.minute + jitter, 0, 0);
    return date;
};

const budgetFor = (input: PlannerInput): number => {
    const base = BUDGET[input.level] ?? BUDGET.normal;
    const quiet = input.state.quietDays;
    // Silence is data. Someone who ignored a week of pushes gets one a day, not
    // five — the alternative is losing the channel to a system-level block.
    if (quiet >= 7) return 1;
    if (quiet >= 4) return Math.max(1, base - 2);
    if (quiet >= 2) return Math.max(1, base - 1);
    return base;
};

/** Slots ranked by this user's own opens, primetime always first. */
const rankSlots = (input: PlannerInput): NotificationSlot[] => {
    const hits = input.state.slotHits;
    const rest = SLOT_PRIORITY.filter((slot) => slot !== "primetime").sort(
        (a, b) => {
            const delta = (hits[b] ?? 0) - (hits[a] ?? 0);
            if (delta !== 0) return delta;
            return SLOT_PRIORITY.indexOf(a) - SLOT_PRIORITY.indexOf(b);
        }
    );
    return ["primetime", ...rest];
};

/* --------------------------------- intents -------------------------------- */

const daysSince = (timestamp: number | null, now: Date): number =>
    timestamp === null
        ? Number.POSITIVE_INFINITY
        : Math.floor((now.getTime() - timestamp) / DAY_MS);

/**
 * What each of today's slots is for. Order is deliberate: the states that mean
 * "this user is about to churn" outrank the ones that just fill the feed.
 */
const assignIntents = (
    slots: NotificationSlot[],
    input: PlannerInput,
    taste: Taste,
    dayOffset: number
): Map<NotificationSlot, NotificationIntent> => {
    const intents = new Map<NotificationSlot, NotificationIntent>();
    const available = [...slots];

    const claim = (
        intent: NotificationIntent,
        preferred?: NotificationSlot
    ) => {
        if (available.length === 0) return;
        const index =
            preferred && available.includes(preferred)
                ? available.indexOf(preferred)
                : 0;
        const [slot] = available.splice(index, 1);
        intents.set(slot, intent);
    };

    // Day 0 is the only day we know the live state of. Later days are planned
    // generically and get rewritten by the next launch.
    if (dayOffset === 0) {
        const lastOpen = daysSince(input.state.lastOpenedAt, input.now);
        const streakAlive =
            input.streak.current >= 2 &&
            input.streak.lastDay !== dayKey(input.now);

        if (lastOpen >= 3) claim("comeback", "primetime");
        if (streakAlive) claim("streak", "latenight");
        if (taste.unfinished.size > 0) claim("resume", "commute");
        if (taste.favorites.size >= 3) claim("favorite", "lunch");
    }

    claim("daily", "primetime");
    claim("short", "lunch");
    claim("short", "latenight");
    while (available.length > 0) claim("discovery");

    return intents;
};

/* ----------------------------------- copy --------------------------------- */

type PushVariant = {
    title: string;
    body: (subject: string) => string;
};

const variantsFor = (intent: NotificationIntent): readonly PushVariant[] =>
    COPY.notification.push[intent] as readonly PushVariant[];

const renderCopy = (
    intent: NotificationIntent,
    subject: string,
    seed: string
): {title: string; body: string} => {
    const variants = variantsFor(intent);
    const variant = variants[hashString(seed) % variants.length];
    return {title: variant.title, body: variant.body(subject)};
};

/* ---------------------------------- planning ------------------------------ */

const poolFor = (
    intent: NotificationIntent,
    input: PlannerInput,
    taste: Taste
): CatalogItem[] => {
    switch (intent) {
        case "short":
            // Shorts are the low-commitment ask: perfect for a lunch break, and
            // the cheapest way to restart a broken streak.
            return input.shorts.slice(0, 400);
        case "resume": {
            const ids = new Set(taste.unfinished.keys());
            return input.videos.filter((item) => ids.has(item.id));
        }
        case "favorite": {
            const seasons = new Set(topSeasons(taste, 3));
            const matching = input.videos.filter(
                (item) =>
                    item.season &&
                    seasons.has(item.season) &&
                    !taste.watched.has(item.id)
            );
            return matching.length > 0 ? matching : input.videos;
        }
        default:
            return input.videos;
    }
};

const subjectFor = (
    intent: NotificationIntent,
    item: CatalogItem | null,
    input: PlannerInput
): string => {
    if (intent === "streak") return String(input.streak.current);
    if (intent === "milestone") return String(input.streak.current);
    return item ? displayTitle(item) : COPY.notification.dailyFallback;
};

/**
 * Builds the full schedule for the next `horizonDays`.
 *
 * Returns notifications sorted by time, already filtered for quiet hours and
 * for slots that have passed today, and capped at what iOS will hold.
 */
export const planNotifications = (
    input: PlannerInput
): PlannedNotification[] => {
    if (input.videos.length === 0) return [];

    const horizon = input.horizonDays ?? 3;
    const taste = tasteFor(input);
    const budget = budgetFor(input);
    const ranked = rankSlots(input);
    const ceiling = Math.max(
        ...input.videos.slice(0, 60).map((item) => popularity(item)),
        1
    );

    const plan: PlannedNotification[] = [];
    // Picked ids are blocked across the whole horizon, not just per day: the
    // same clip three nights running is how a user learns to ignore us.
    const taken = new Set<string>(taste.recent);

    for (let dayOffset = 0; dayOffset < horizon; dayOffset++) {
        const day = new Date(input.now.getTime() + dayOffset * DAY_MS);
        const slots = ranked.slice(0, budget);
        const intents = assignIntents(slots, input, taste, dayOffset);

        for (const slot of slots) {
            const intent = intents.get(slot) ?? "discovery";
            const fireAt = slotTime(slot, day, input);
            const hour = fireAt.getHours();

            if (hour >= QUIET_FROM && hour < QUIET_UNTIL) continue;
            // A slot that already passed today is not "late", it is next week.
            if (fireAt.getTime() < input.now.getTime() + 5 * MINUTE_MS)
                continue;

            const seed = `${input.state.salt}-${dayKey(day)}-${slot}`;
            const item =
                intent === "streak" || intent === "milestone"
                    ? null
                    : pickBest(
                          poolFor(intent, input, taste),
                          {
                              taste,
                              ceiling,
                              seed,
                          },
                          taken
                      );

            if (item) taken.add(item.id);

            const {title, body} = renderCopy(
                intent,
                subjectFor(intent, item, input),
                seed
            );

            plan.push({
                id: `hh-${dayKey(day)}-${slot}`,
                slot,
                intent,
                fireAt: fireAt.getTime(),
                title,
                body,
                data: {
                    intent,
                    slot,
                    ...(item ? {videoId: item.id, kind: item.kind} : {}),
                },
            });
        }
    }

    return plan.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_SCHEDULED);
};

/**
 * The state to persist after applying a plan: the fatigue window, the back-off
 * counter and the day stamp. Kept next to the planner so the two can never
 * disagree about what "a quiet day" means.
 */
export const nextStateAfterPlan = (
    input: PlannerInput,
    plan: PlannedNotification[]
): NotificationState => {
    const today = dayKey(input.now);
    const state = input.state;
    const isNewDay = state.lastPlanDay !== null && state.lastPlanDay !== today;
    // Day keys are YYYY-MM-DD, so a string compare is a date compare.
    const openedSinceLastPlan =
        state.lastOpenedAt !== null &&
        state.lastPlanDay !== null &&
        dayKey(new Date(state.lastOpenedAt)) >= state.lastPlanDay;

    const pushedIds = plan
        .map((entry) => entry.data.videoId)
        .filter((id): id is string => Boolean(id));

    // De-duplicated: the plan is rebuilt on every launch, and letting the same
    // ids stack up would shrink the real fatigue window to a handful of clips.
    const recentIds = [...new Set([...pushedIds, ...state.recentIds])].slice(
        0,
        FATIGUE_WINDOW
    );

    return {
        ...state,
        recentIds,
        lastPlanDay: today,
        quietDays: isNewDay
            ? openedSinceLastPlan
                ? 0
                : state.quietDays + 1
            : state.quietDays,
    };
};

/** Records a tap so the schedule learns which hour this user answers. */
export const registerOpen = (
    state: NotificationState,
    slot: NotificationSlot | undefined,
    at: number = Date.now()
): NotificationState => ({
    ...state,
    lastOpenedAt: at,
    quietDays: 0,
    slotHits: slot
        ? {...state.slotHits, [slot]: (state.slotHits[slot] ?? 0) + 1}
        : state.slotHits,
});

/** Per-install seed for the jitter. Generated once, then persisted. */
export const createSalt = (): string => Math.random().toString(36).slice(2, 10);

export const NOTIFICATION_LEVELS: NotificationLevel[] = [
    "chill",
    "normal",
    "hardcore",
];

export const pushesPerDay = (level: NotificationLevel): number =>
    BUDGET[level] ?? BUDGET.normal;
