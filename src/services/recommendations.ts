import {COPY} from "@/constants/copy";
import type {CatalogItem, HistoryEntry, VideoKind} from "@/models/video";
import {popularity, relatedIn} from "@/services/catalog";
import {
    affinityScore,
    buildTaste,
    type Taste,
    topSeasons,
} from "@/services/taste";
import {dayKey, hashString} from "@/utils/date";
import {displayTitle} from "@/utils/format";

/**
 * The rail engine.
 *
 * A flat list of 535 episodes is a filing cabinet. Nobody opens a filing
 * cabinet for fun. What makes someone press play is a reason to press play, so
 * every rail here is one explicit argument: "porque viste X", "esto le gusta a
 * todos", "esta la dejaste botada", "esta casi nadie la vio y es buenaza".
 *
 * Rules the whole file obeys:
 *  - Pure. Same input, same rails. No storage, no navigation, no clock beyond
 *    the `now` it is handed, so every rail is unit-testable.
 *  - Deterministic per day. Rails that reshuffle while the user's thumb is
 *    moving feel broken, so the only randomness is a per-day hash wobble.
 *  - No rail without content. An empty or one-item rail is worse than no rail;
 *    every builder drops itself below `MIN_ITEMS`.
 *  - No clip twice. A carousel that repeats across four rails reads as a small
 *    catalog, and this one is not small.
 */

export type RailId =
    | "continue"
    | "forYou"
    | "because"
    | "starter"
    | "trending"
    | "loved"
    | "gems"
    | "season"
    | "quick"
    | "vault"
    | "favorites"
    | "likeFavorites"
    | "unfinishedFavorites";

export type Rail = {
    id: RailId;
    title: string;
    subtitle?: string;
    items: CatalogItem[];
    /** Set when tapping the header should open another screen. */
    action?: "favorites" | "shorts" | "home";
};

export type RecommendationInput = {
    videos: CatalogItem[];
    shorts: CatalogItem[];
    /** Newest first. */
    history: HistoryEntry[];
    favoriteIds: string[];
    now?: Date;
};

/** Cards per rail. Enough to feel deep, few enough to stay swipeable. */
const RAIL_SIZE = 12;

/**
 * How many each builder actually returns.
 *
 * Rails are picked independently and de-duplicated afterwards, so two rails
 * that agree — "empieza por acá" and "lo más visto" rank the same way — would
 * leave the second one empty if each only produced twelve. Over-fetching and
 * trimming after the de-dup means the loser of an overlap drops to its next
 * twelve instead of disappearing.
 */
const RAIL_FETCH = RAIL_SIZE * 3;

/** Below this a rail is noise, so it never renders. */
const MIN_ITEMS = 3;

/** How much of the shorts catalog the picks are drawn from. */
const SHORTS_POOL = 400;

/* ------------------------------- primitives ------------------------------- */

type Pick = {
    pool: CatalogItem[];
    /** Defaults to the over-fetch size; `assemble` trims to `RAIL_SIZE`. */
    count?: number;
    /** Ids already spoken for by an earlier rail. */
    exclude?: Set<string>;
};

const take = (
    ranked: CatalogItem[],
    count: number,
    exclude?: Set<string>
): CatalogItem[] => {
    const out: CatalogItem[] = [];
    for (const item of ranked) {
        if (out.length >= count) break;
        if (exclude?.has(item.id)) continue;
        out.push(item);
    }
    return out;
};

/** Straight popularity: views, nudged by the likes/views ratio. */
export const mostPopular = ({
    pool,
    count = RAIL_FETCH,
    exclude,
}: Pick): CatalogItem[] =>
    take(
        [...pool].sort((a, b) => popularity(b) - popularity(a)),
        count,
        exclude
    );

/**
 * Ranked by raw likes.
 *
 * Only the clips whose stats were refreshed carry a like count, so this rail
 * deliberately draws from a smaller pool than the rest — and disappears
 * entirely on a dataset that has none.
 */
export const mostLiked = ({
    pool,
    count = RAIL_FETCH,
    exclude,
}: Pick): CatalogItem[] => {
    const rated = pool.filter((item) => (item.like_count ?? 0) > 0);
    if (rated.length < MIN_ITEMS) return [];
    return take(
        rated.sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0)),
        count,
        exclude
    );
};

/**
 * Loved but unseen: a strong likes/views ratio on a clip that never got the
 * views. This is the rail that makes a 500-episode back catalog feel worth
 * digging through instead of just replaying the same five virals.
 */
export const hiddenGems = ({
    pool,
    count = RAIL_FETCH,
    exclude,
}: Pick): CatalogItem[] => {
    const rated = pool.filter(
        (item) => item.like_ratio !== undefined && (item.view_count ?? 0) > 0
    );
    if (rated.length < MIN_ITEMS * 2) return [];

    const views = rated
        .map((item) => item.view_count ?? 0)
        .sort((a, b) => a - b);
    const median = views[Math.floor(views.length / 2)];

    const underexposed = rated
        .filter((item) => (item.view_count ?? 0) <= median)
        .sort((a, b) => (b.like_ratio ?? 0) - (a.like_ratio ?? 0));

    return take(underexposed, count, exclude);
};

/**
 * The deep catalog. The dataset is newest first, so the tail is the old stuff —
 * ranked by popularity so "old" never means "bad".
 */
export const fromVault = ({
    pool,
    count = RAIL_FETCH,
    exclude,
}: Pick): CatalogItem[] =>
    mostPopular({
        pool: pool.slice(Math.floor(pool.length / 2)),
        count,
        exclude,
    });

/**
 * Personal ranking.
 *
 * Same signals the notifications use, different weights. A push is an
 * interruption, so it leans on novelty; a rail is an offer the user is already
 * browsing, so taste leads and quality backs it up.
 */
export const rankByTaste = (
    {pool, count = RAIL_FETCH, exclude}: Pick,
    taste: Taste,
    seed: string
): CatalogItem[] => {
    const ceiling = Math.max(
        ...pool.slice(0, 80).map((item) => popularity(item)),
        1
    );

    const scored = pool.map((item, index) => {
        const quality = popularity(item) / ceiling;
        const freshness = 1 - index / Math.max(pool.length, 1);
        const novelty = taste.watched.has(item.id) ? 0.1 : 1;
        // Stable per day and per install: the rail is the same all day and
        // different tomorrow, which is what makes coming back worth it.
        const wobble = (hashString(`${seed}-${item.id}`) % 100) / 1000;

        return {
            item,
            score:
                affinityScore(item, taste) * 0.42 +
                Math.sqrt(Math.max(quality, 0)) * 0.28 +
                novelty * 0.2 +
                freshness * 0.05 +
                wobble,
        };
    });

    return take(
        scored.sort((a, b) => b.score - a.score).map((entry) => entry.item),
        count,
        exclude
    );
};

/* --------------------------------- helpers -------------------------------- */

const indexById = (input: RecommendationInput): Map<string, CatalogItem> =>
    new Map([...input.videos, ...input.shorts].map((item) => [item.id, item]));

/** The clip a "porque viste X" rail hangs off: the last real watch. */
const lastWatched = (input: RecommendationInput): CatalogItem | null => {
    const byId = indexById(input);
    for (const entry of input.history) {
        const item = byId.get(entry.id);
        // Shorts are flicked through by the dozen; anchoring a whole rail on
        // one is a coin flip. An episode is a real choice.
        if (item && item.kind === "video") return item;
    }
    return null;
};

const seasonPool = (
    pool: CatalogItem[],
    seasons: string[],
    taste: Taste
): CatalogItem[] => {
    const wanted = new Set(seasons);
    return pool.filter(
        (item) =>
            item.season &&
            wanted.has(item.season) &&
            !taste.watched.has(item.id)
    );
};

/** Started and left hanging, newest first. The highest-intent row we have. */
const unfinishedItems = (
    input: RecommendationInput,
    taste: Taste
): CatalogItem[] => {
    const byId = indexById(input);
    const out: CatalogItem[] = [];
    for (const id of taste.unfinished.keys()) {
        const item = byId.get(id);
        if (item) out.push(item);
    }
    return out;
};

const rail = (
    id: RailId,
    title: string,
    items: CatalogItem[],
    extra: {subtitle?: string; action?: Rail["action"]} = {}
): Rail | null =>
    items.length >= MIN_ITEMS ? {id, title, items, ...extra} : null;

/**
 * Drops the empties, trims to the visible size and books every surviving item
 * so no clip appears on two rails. Order matters: whatever comes first in
 * `candidates` gets first pick of the catalog.
 */
const assemble = (candidates: (Rail | null)[], used: Set<string>): Rail[] => {
    const rails: Rail[] = [];
    for (const candidate of candidates) {
        if (!candidate) continue;
        const items = candidate.items
            .filter((item) => !used.has(item.id))
            .slice(0, RAIL_SIZE);
        if (items.length < MIN_ITEMS) continue;
        for (const item of items) used.add(item.id);
        rails.push({...candidate, items});
    }
    return rails;
};

/* ---------------------------------- home ---------------------------------- */

/**
 * Inicio, in priority order.
 *
 * The order is the whole argument. Personal beats popular, because a rail that
 * knows you converts better than a rail that knows everyone; popular beats
 * deep, because a new user has no personal signal and still needs a reason to
 * press play in the first ten seconds.
 */
export const buildHomeRails = (input: RecommendationInput): Rail[] => {
    const now = input.now ?? new Date();
    const seed = dayKey(now);
    const taste = buildTaste({
        videos: input.videos,
        shorts: input.shorts,
        history: input.history,
        favoriteIds: input.favoriteIds,
    });

    // Continue-watching has its own rail on screen, and favourites have their
    // own tab. Repeating either here wastes the most valuable rows on screen.
    const used = new Set<string>([
        ...taste.unfinished.keys(),
        ...input.favoriteIds,
    ]);

    const anchor = lastWatched(input);
    const seasons = topSeasons(taste, 2);

    const candidates: (Rail | null)[] = [
        taste.isCold
            ? rail(
                  "starter",
                  COPY.rails.starterTitle,
                  mostPopular({pool: input.videos}),
                  {subtitle: COPY.rails.starterSubtitle}
              )
            : rail(
                  "forYou",
                  COPY.rails.forYouTitle,
                  rankByTaste({pool: input.videos}, taste, seed),
                  {subtitle: COPY.rails.forYouSubtitle}
              ),

        anchor
            ? rail(
                  "because",
                  COPY.rails.becauseTitle(displayTitle(anchor)),
                  relatedIn(anchor, input.videos, RAIL_FETCH),
                  {subtitle: COPY.rails.becauseSubtitle}
              )
            : null,

        rail(
            "trending",
            COPY.rails.trendingTitle,
            mostPopular({pool: input.videos}),
            {subtitle: COPY.rails.trendingSubtitle}
        ),

        rail("loved", COPY.rails.lovedTitle, mostLiked({pool: input.videos}), {
            subtitle: COPY.rails.lovedSubtitle,
        }),

        seasons.length > 0
            ? rail(
                  "season",
                  COPY.rails.seasonTitle(seasons[0]),
                  mostPopular({pool: seasonPool(input.videos, seasons, taste)}),
                  {subtitle: COPY.rails.seasonSubtitle}
              )
            : null,

        rail(
            "quick",
            COPY.rails.quickTitle,
            rankByTaste(
                {pool: input.shorts.slice(0, SHORTS_POOL)},
                taste,
                seed
            ),
            {subtitle: COPY.rails.quickSubtitle, action: "shorts"}
        ),

        rail("gems", COPY.rails.gemsTitle, hiddenGems({pool: input.videos}), {
            subtitle: COPY.rails.gemsSubtitle,
        }),

        rail("vault", COPY.rails.vaultTitle, fromVault({pool: input.videos}), {
            subtitle: COPY.rails.vaultSubtitle,
        }),
    ];

    return assemble(candidates, used);
};

/* -------------------------------- favorites ------------------------------- */

export type FavoriteRailsInput = RecommendationInput & {
    /** Already-resolved favourites, newest first. */
    favorites: CatalogItem[];
};

/**
 * Favoritos, below the saved grid.
 *
 * A favourites screen that only lists favourites is a dead end: the user has
 * already seen everything on it. These rails turn the list into a lead — what
 * you saved is the best description of what you want next.
 */
export const buildFavoriteRails = (input: FavoriteRailsInput): Rail[] => {
    const now = input.now ?? new Date();
    const seed = `fav-${dayKey(now)}`;
    const taste = buildTaste({
        videos: input.videos,
        shorts: input.shorts,
        history: input.history,
        favoriteIds: input.favoriteIds,
    });

    const favoriteIds = new Set(input.favoriteIds);
    // The grid above already shows every favourite, so no rail may repeat one.
    const used = new Set<string>(favoriteIds);
    const seasons = topSeasons(taste, 3);

    /*
     * Saved and never finished is the highest-intent row in the app — the user
     * told us twice that they want this one — so it is the exception to the
     * no-repeat rule above and is stitched on ahead of everything else.
     */
    const unfinished = rail(
        "unfinishedFavorites",
        COPY.rails.unfinishedTitle,
        input.favorites
            .filter((item) => taste.unfinished.has(item.id))
            .slice(0, RAIL_SIZE),
        {subtitle: COPY.rails.unfinishedSubtitle}
    );

    const candidates: (Rail | null)[] = [
        rail(
            "likeFavorites",
            COPY.rails.likeFavoritesTitle,
            rankByTaste(
                {
                    pool: input.videos.filter(
                        (item) => !favoriteIds.has(item.id)
                    ),
                },
                taste,
                seed
            ),
            {subtitle: COPY.rails.likeFavoritesSubtitle}
        ),

        seasons.length > 0
            ? rail(
                  "season",
                  COPY.rails.seasonTitle(seasons[0]),
                  mostPopular({pool: seasonPool(input.videos, seasons, taste)}),
                  {subtitle: COPY.rails.seasonSubtitle}
              )
            : null,

        rail(
            "quick",
            COPY.rails.quickTitle,
            rankByTaste(
                {pool: input.shorts.slice(0, SHORTS_POOL)},
                taste,
                seed
            ),
            {subtitle: COPY.rails.quickSubtitle, action: "shorts"}
        ),

        rail("loved", COPY.rails.lovedTitle, mostLiked({pool: input.videos}), {
            subtitle: COPY.rails.lovedSubtitle,
        }),

        rail("gems", COPY.rails.gemsTitle, hiddenGems({pool: input.videos}), {
            subtitle: COPY.rails.gemsSubtitle,
        }),
    ];

    const rails = assemble(candidates, used);
    return unfinished ? [unfinished, ...rails] : rails;
};

/* ---------------------------------- detail -------------------------------- */

export type DetailRailsInput = RecommendationInput & {
    /** The clip on screen. Never appears on its own rails. */
    current: CatalogItem;
};

/**
 * The rails under the player.
 *
 * This screen is where a session either continues or ends, and it used to end:
 * one row of related clips and then black. The order below walks outwards from
 * what the user is watching right now — this clip, its season, what they left
 * unfinished — and only then falls back to the same house rails Inicio uses. By
 * the time someone has scrolled past all of it, they have been offered seven
 * different reasons to not close the app.
 */
export const buildDetailRails = (input: DetailRailsInput): Rail[] => {
    const current = input.current;
    const now = input.now ?? new Date();
    const seed = `${dayKey(now)}-${current.id}`;
    const taste = buildTaste({
        videos: input.videos,
        shorts: input.shorts,
        history: input.history,
        favoriteIds: input.favoriteIds,
    });

    // Whatever is playing is never also a recommendation.
    const used = new Set<string>([current.id]);
    const siblings = current.kind === "short" ? input.shorts : input.videos;

    const candidates: (Rail | null)[] = [
        rail(
            "because",
            COPY.player.related,
            relatedIn(current, siblings, RAIL_FETCH),
            {subtitle: COPY.rails.becauseSubtitle}
        ),

        current.season
            ? rail(
                  "season",
                  COPY.rails.seasonMoreTitle(current.season),
                  mostPopular({
                      pool: input.videos.filter(
                          (item) => item.season === current.season
                      ),
                  }),
                  {subtitle: COPY.rails.seasonMoreSubtitle}
              )
            : null,

        rail(
            "continue",
            COPY.rails.continueTitle,
            unfinishedItems(input, taste),
            {subtitle: COPY.rails.continueSubtitle}
        ),

        taste.isCold
            ? rail(
                  "starter",
                  COPY.rails.starterTitle,
                  mostPopular({pool: input.videos}),
                  {subtitle: COPY.rails.starterSubtitle}
              )
            : rail(
                  "forYou",
                  COPY.rails.forYouTitle,
                  rankByTaste({pool: input.videos}, taste, seed),
                  {subtitle: COPY.rails.forYouSubtitle}
              ),

        rail(
            "trending",
            COPY.rails.trendingTitle,
            mostPopular({pool: input.videos}),
            {subtitle: COPY.rails.trendingSubtitle}
        ),

        rail(
            "quick",
            COPY.rails.quickTitle,
            rankByTaste(
                {pool: input.shorts.slice(0, SHORTS_POOL)},
                taste,
                seed
            ),
            {subtitle: COPY.rails.quickSubtitle, action: "shorts"}
        ),

        rail("gems", COPY.rails.gemsTitle, hiddenGems({pool: input.videos}), {
            subtitle: COPY.rails.gemsSubtitle,
        }),
    ];

    return assemble(candidates, used);
};

/**
 * What plays when this one ends.
 *
 * Rails are already ordered by how close they sit to the clip on screen, so the
 * first unseen item of the same kind is, by construction, the best related clip
 * the user has not watched — falling back to the best related clip full stop.
 * Autoplay only earns its keep if the handoff is good; a rerun of something
 * watched last week is how people learn to switch it off.
 */
export type NextUpOptions = {
    /** Ids already seen. Skipped when possible, never banned outright. */
    watched?: Set<string>;
    /** Keeps the handoff on the same kind the user is already watching. */
    kind?: VideoKind;
    /** The clip on screen. A screen must never hand over to itself. */
    exclude?: string;
};

export const nextUp = (
    rails: Rail[],
    {watched, kind, exclude}: NextUpOptions = {}
): CatalogItem | null => {
    const pool = railPool(rails, kind).filter((item) => item.id !== exclude);
    return pool.find((item) => !watched?.has(item.id)) ?? pool[0] ?? null;
};

/* ------------------------------- memoisation ------------------------------ */

/**
 * Rails are rebuilt whenever history changes — and history changes on every
 * progress tick while a video plays. Keying on the ids (not the positions)
 * means a playing video re-uses the exact same array, so jotai stops the
 * update at the atom and the home screen never re-renders mid-playback.
 */
const cacheKey = (
    input: RecommendationInput,
    scope: string,
    extra = ""
): string =>
    [
        scope,
        extra,
        dayKey(input.now ?? new Date()),
        input.history.map((entry) => entry.id).join(","),
        input.favoriteIds.join(","),
        input.videos.length,
        input.shorts.length,
    ].join("|");

/** One slot per scope: the previous value is dead the moment the key moves. */
const memo = new Map<string, {key: string; rails: Rail[]}>();

const memoised = (
    scope: string,
    input: RecommendationInput,
    build: () => Rail[],
    extra?: string
): Rail[] => {
    const key = cacheKey(input, scope, extra);
    const hit = memo.get(scope);
    if (hit?.key === key) return hit.rails;
    const rails = build();
    memo.set(scope, {key, rails});
    return rails;
};

export const homeRails = (input: RecommendationInput): Rail[] =>
    memoised("home", input, () => buildHomeRails(input));

export const favoriteRails = (input: FavoriteRailsInput): Rail[] =>
    memoised("favorites", input, () => buildFavoriteRails(input));

/*
 * One slot, keyed by the clip on screen: swapping clips inside the player
 * evicts the previous set instead of stacking one per video ever opened.
 */
export const detailRails = (input: DetailRailsInput): Rail[] =>
    memoised("detail", input, () => buildDetailRails(input), input.current.id);

/** Flattens rails into a play queue — used by "sorpréndeme" on both screens. */
export const railPool = (rails: Rail[], kind?: VideoKind): CatalogItem[] => {
    const seen = new Set<string>();
    const out: CatalogItem[] = [];
    for (const entry of rails) {
        for (const item of entry.items) {
            if (kind && item.kind !== kind) continue;
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            out.push(item);
        }
    }
    return out;
};

export const resetRecommendationCache = () => memo.clear();
