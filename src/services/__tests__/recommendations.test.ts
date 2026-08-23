import type {CatalogItem, HistoryEntry} from "@/models/video";
import type {FavoriteRailsInput} from "@/services/recommendations";
import {
    buildDetailRails,
    buildFavoriteRails,
    buildHomeRails,
    favoriteRails,
    hiddenGems,
    homeRails,
    mostLiked,
    mostPopular,
    nextUp,
    railPool,
    rankByTaste,
    resetRecommendationCache,
} from "@/services/recommendations";
import {buildTaste} from "@/services/taste";

const video = (
    id: string,
    overrides: Partial<CatalogItem> = {}
): CatalogItem => ({
    id,
    link: `https://youtu.be/${id}`,
    title: `HABLANDO HUEVADAS - ${id}`,
    title_clean: id,
    view_count: 100_000,
    thumbnail: null,
    kind: "video",
    ...overrides,
});

const short = (id: string, overrides: Partial<CatalogItem> = {}): CatalogItem =>
    video(id, {kind: "short", ...overrides});

const watched = (
    id: string,
    overrides: Partial<HistoryEntry> = {}
): HistoryEntry => ({
    id,
    kind: "video",
    watchedAt: Date.now(),
    positionSeconds: 600,
    durationSeconds: 1000,
    ...overrides,
});

/** Enough items that every rail clears its minimum. */
const catalog = (count: number, prefix = "v"): CatalogItem[] =>
    Array.from({length: count}, (_, index) =>
        video(`${prefix}${index}`, {view_count: (count - index) * 1000})
    );

const NOW = new Date("2026-03-04T12:00:00");

const input = (
    overrides: Partial<FavoriteRailsInput> = {}
): FavoriteRailsInput => ({
    videos: catalog(40),
    shorts: catalog(20, "s").map((item) => ({...item, kind: "short" as const})),
    history: [],
    favoriteIds: [],
    favorites: [],
    now: NOW,
    ...overrides,
});

beforeEach(() => resetRecommendationCache());

describe("rail primitives", () => {
    it("ranks by popularity", () => {
        const picks = mostPopular({pool: catalog(10), count: 3});
        expect(picks.map((item) => item.id)).toEqual(["v0", "v1", "v2"]);
    });

    it("skips ids an earlier rail already used", () => {
        const picks = mostPopular({
            pool: catalog(10),
            count: 3,
            exclude: new Set(["v0", "v1"]),
        });
        expect(picks.map((item) => item.id)).toEqual(["v2", "v3", "v4"]);
    });

    it("ranks by raw likes and drops itself without like data", () => {
        const pool = [
            video("a", {like_count: 10}),
            video("b", {like_count: 900}),
            video("c", {like_count: 400}),
        ];
        expect(mostLiked({pool}).map((item) => item.id)).toEqual([
            "b",
            "c",
            "a",
        ]);
        expect(mostLiked({pool: catalog(10)})).toEqual([]);
    });

    it("surfaces well-liked clips that nobody watched", () => {
        const pool = [
            ...catalog(6).map((item) => ({...item, like_ratio: 0.001})),
            video("gem", {view_count: 500, like_ratio: 0.09}),
        ];
        expect(hiddenGems({pool, count: 1})[0].id).toBe("gem");
    });

    it("puts what the user already likes on top", () => {
        const pool = [
            ...catalog(20),
            video("bordercollie", {
                title_clean: "El perro bordercollie desquiciado",
                view_count: 10,
            }),
        ];
        const taste = buildTaste({
            videos: pool,
            shorts: [],
            history: [watched("bordercollie")],
            favoriteIds: [],
        });
        // Watched items are demoted, so the match shows up through its
        // neighbours rather than as itself.
        const ranked = rankByTaste({pool, count: 5}, taste, "seed");
        expect(ranked).toHaveLength(5);
        expect(ranked.map((item) => item.id)).not.toContain("bordercollie");
    });

    it("is stable for a given day and moves the next one", () => {
        const pool = catalog(30);
        const taste = buildTaste({
            videos: pool,
            shorts: [],
            history: [],
            favoriteIds: [],
        });
        const monday = rankByTaste({pool}, taste, "2026-03-04");
        const tuesday = rankByTaste({pool}, taste, "2026-03-05");
        expect(rankByTaste({pool}, taste, "2026-03-04")).toEqual(monday);
        expect(tuesday).not.toEqual(monday);
    });
});

describe("home rails", () => {
    it("opens with the crowd pleasers when it knows nothing", () => {
        const rails = buildHomeRails(input());
        expect(rails[0].id).toBe("starter");
        expect(rails.some((rail) => rail.id === "because")).toBe(false);
    });

    it("switches to a personal rail once there is history", () => {
        const rails = buildHomeRails(
            input({history: [watched("v3"), watched("v4")]})
        );
        expect(rails[0].id).toBe("forYou");
    });

    it("explains itself with the last episode watched", () => {
        const rails = buildHomeRails(input({history: [watched("v7")]}));
        const because = rails.find((rail) => rail.id === "because");
        expect(because?.title).toContain("v7");
    });

    it("anchors on an episode, never on a flicked-through short", () => {
        const rails = buildHomeRails(
            input({
                history: [watched("s2", {kind: "short"}), watched("v9")],
            })
        );
        expect(rails.find((rail) => rail.id === "because")?.title).toContain(
            "v9"
        );
    });

    it("never shows the same clip on two rails", () => {
        const rails = buildHomeRails(input({history: [watched("v2")]}));
        const ids = rails.flatMap((rail) => rail.items.map((item) => item.id));
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("leaves favourites and half-watched clips to their own rows", () => {
        const rails = buildHomeRails(
            input({history: [watched("v5")], favoriteIds: ["v8"]})
        );
        const ids = rails.flatMap((rail) => rail.items.map((item) => item.id));
        expect(ids).not.toContain("v5");
        expect(ids).not.toContain("v8");
    });

    it("drops rails that cannot fill themselves", () => {
        const rails = buildHomeRails(input({videos: catalog(2), shorts: []}));
        for (const rail of rails) {
            expect(rail.items.length).toBeGreaterThanOrEqual(3);
        }
    });

    it("returns nothing at all for an empty catalog", () => {
        expect(buildHomeRails(input({videos: [], shorts: []}))).toEqual([]);
    });

    it("sends the shorts rail to the shorts tab", () => {
        const rails = buildHomeRails(input());
        expect(rails.find((rail) => rail.id === "quick")?.action).toBe(
            "shorts"
        );
    });
});

describe("favorite rails", () => {
    const favorites = [video("v1"), video("v2"), video("v3")];

    it("puts the saved-but-unfinished ones first", () => {
        const rails = buildFavoriteRails(
            input({
                favorites,
                favoriteIds: ["v1", "v2", "v3"],
                history: [
                    watched("v1", {positionSeconds: 100}),
                    watched("v2", {positionSeconds: 200}),
                    watched("v3", {positionSeconds: 300}),
                ],
            })
        );
        expect(rails[0].id).toBe("unfinishedFavorites");
        expect(rails[0].items).toHaveLength(3);
    });

    it("never repeats a favourite in the rails below the list", () => {
        const rails = buildFavoriteRails(
            input({favorites, favoriteIds: ["v1", "v2", "v3"]})
        );
        const ids = rails
            .filter((rail) => rail.id !== "unfinishedFavorites")
            .flatMap((rail) => rail.items.map((item) => item.id));
        expect(ids).not.toContain("v1");
    });

    it("still fills the screen when nothing is saved yet", () => {
        const rails = buildFavoriteRails(
            input({favorites: [], favoriteIds: []})
        );
        expect(rails.length).toBeGreaterThan(0);
    });
});

describe("detail rails", () => {
    const current = () => video("v10", {season: "T6"});

    const seasoned = (overrides: Partial<FavoriteRailsInput> = {}) =>
        input({
            videos: catalog(40).map((entry, index) =>
                index % 2 === 0 ? {...entry, season: "T6"} : entry
            ),
            ...overrides,
        });

    it("leads with the clip's own neighbours and its season", () => {
        const rails = buildDetailRails({...seasoned(), current: current()});
        expect(rails[0].id).toBe("because");
        expect(rails[1].id).toBe("season");
        expect(rails[1].title).toContain("T6");
    });

    it("drops the season row for a clip that has none", () => {
        const rails = buildDetailRails({
            ...input(),
            current: video("v10"),
        });
        expect(rails.some((rail) => rail.id === "season")).toBe(false);
    });

    it("never recommends the clip that is playing", () => {
        const rails = buildDetailRails({...seasoned(), current: current()});
        const ids = rails.flatMap((rail) => rail.items.map((i) => i.id));
        expect(ids).not.toContain("v10");
    });

    it("resurfaces what the user left hanging", () => {
        const rails = buildDetailRails({
            ...input({
                history: [
                    watched("v1", {positionSeconds: 100}),
                    watched("v2", {positionSeconds: 100}),
                    watched("v3", {positionSeconds: 100}),
                ],
            }),
            current: video("v10"),
        });
        const resume = rails.find((rail) => rail.id === "continue");
        expect(resume?.items.map((i) => i.id)).toEqual(["v1", "v2", "v3"]);
    });

    it("fills the screen even for a brand new user", () => {
        const rails = buildDetailRails({...input(), current: video("v10")});
        expect(rails.length).toBeGreaterThanOrEqual(4);
        for (const rail of rails) {
            expect(rail.items.length).toBeGreaterThanOrEqual(3);
        }
    });
});

describe("nextUp", () => {
    const rails = (): Parameters<typeof nextUp>[0] => [
        {id: "because", title: "a", items: [video("x"), video("y")]},
        {id: "quick", title: "b", items: [short("z")]},
    ];

    it("hands over the closest clip the user has not seen", () => {
        expect(nextUp(rails(), {watched: new Set(["x"])})?.id).toBe("y");
    });

    it("falls back to the best related clip when everything is seen", () => {
        expect(nextUp(rails(), {watched: new Set(["x", "y", "z"])})?.id).toBe(
            "x"
        );
    });

    it("stays on the kind the user is watching", () => {
        expect(
            nextUp(rails(), {watched: new Set(["x", "y"]), kind: "video"})?.id
        ).toBe("x");
        expect(nextUp(rails(), {kind: "short"})?.id).toBe("z");
    });

    it("never hands a screen back to the clip it is already showing", () => {
        expect(nextUp(rails(), {exclude: "x"})?.id).toBe("y");
    });

    it("returns nothing when there is nothing to hand over", () => {
        expect(nextUp([])).toBeNull();
    });
});

describe("memoisation", () => {
    it("re-uses the same arrays while only the play position moves", () => {
        const first = homeRails(input({history: [watched("v1")]}));
        const second = homeRails(
            input({history: [watched("v1", {positionSeconds: 999})]})
        );
        expect(second).toBe(first);
    });

    it("rebuilds when the user watches something new", () => {
        const first = homeRails(input({history: [watched("v1")]}));
        const second = homeRails(
            input({history: [watched("v2"), watched("v1")]})
        );
        expect(second).not.toBe(first);
    });

    it("keeps home and favourites in separate slots", () => {
        const home = homeRails(input());
        favoriteRails(input({favorites: [], favoriteIds: []}));
        expect(homeRails(input())).toBe(home);
    });
});

describe("railPool", () => {
    it("flattens the rails into a de-duplicated queue", () => {
        const pool = railPool([
            {id: "trending", title: "a", items: [video("x"), video("y")]},
            {id: "loved", title: "b", items: [video("y"), short("z")]},
        ]);
        expect(pool.map((item) => item.id)).toEqual(["x", "y", "z"]);
    });

    it("filters by kind when asked", () => {
        const pool = railPool(
            [{id: "quick", title: "a", items: [video("x"), short("z")]}],
            "short"
        );
        expect(pool.map((item) => item.id)).toEqual(["z"]);
    });
});
