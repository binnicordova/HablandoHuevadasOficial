import type {CatalogItem, HistoryEntry} from "@/models/video";
import {
    affinityScore,
    buildTaste,
    tokenize,
    topSeasons,
} from "@/services/taste";

const video = (
    id: string,
    overrides: Partial<CatalogItem> = {}
): CatalogItem => ({
    id,
    link: `https://youtu.be/${id}`,
    title: `HABLANDO HUEVADAS - ${id}`,
    view_count: 1000,
    thumbnail: null,
    kind: "video",
    ...overrides,
});

const watched = (
    id: string,
    overrides: Partial<HistoryEntry> = {}
): HistoryEntry => ({
    id,
    kind: "video",
    watchedAt: Date.now(),
    positionSeconds: 100,
    durationSeconds: 1000,
    ...overrides,
});

describe("tokenize", () => {
    it("drops short words, accents and the words in every title", () => {
        expect(tokenize("Hablando Huevadas: la MAMÁ del Ricardo")).toEqual([
            "mama",
            "ricardo",
        ]);
    });
});

describe("buildTaste", () => {
    const videos = [
        video("a", {title_clean: "El taxista chalaco", season: "T1"}),
        video("b", {title_clean: "El taxista limeño", season: "T1"}),
        video("c", {title_clean: "Cumbia peruana", season: "T9"}),
    ];

    it("starts cold and warms up on the first watch", () => {
        const cold = buildTaste({
            videos,
            shorts: [],
            history: [],
            favoriteIds: [],
        });
        expect(cold.isCold).toBe(true);

        const warm = buildTaste({
            videos,
            shorts: [],
            history: [watched("a")],
            favoriteIds: [],
        });
        expect(warm.isCold).toBe(false);
    });

    it("counts a save as a signal even with no watch history", () => {
        const taste = buildTaste({
            videos,
            shorts: [],
            history: [],
            favoriteIds: ["c"],
        });
        expect(taste.isCold).toBe(false);
    });

    it("remembers what was left half-watched, and only that", () => {
        const taste = buildTaste({
            videos,
            shorts: [],
            history: [
                watched("a", {positionSeconds: 500}),
                watched("b", {positionSeconds: 990}),
            ],
            favoriteIds: [],
        });
        expect([...taste.unfinished.keys()]).toEqual(["a"]);
    });

    it("scores an unseen clip higher when it shares the season and words", () => {
        const taste = buildTaste({
            videos,
            shorts: [],
            history: [watched("a")],
            favoriteIds: [],
        });
        expect(affinityScore(videos[1], taste)).toBeGreaterThan(
            affinityScore(videos[2], taste)
        );
    });

    it("weighs a save heavier than a passive watch", () => {
        const saved = buildTaste({
            videos,
            shorts: [],
            history: [],
            favoriteIds: ["a"],
        });
        const seen = buildTaste({
            videos,
            shorts: [],
            history: [watched("a")],
            favoriteIds: [],
        });
        expect(affinityScore(videos[1], saved)).toBeGreaterThan(
            affinityScore(videos[1], seen)
        );
    });

    it("ranks the seasons the user keeps returning to", () => {
        const taste = buildTaste({
            videos,
            shorts: [],
            history: [watched("a"), watched("b"), watched("c")],
            favoriteIds: [],
        });
        expect(topSeasons(taste, 1)).toEqual(["T1"]);
    });

    it("ignores history for clips that are no longer in the catalog", () => {
        const taste = buildTaste({
            videos,
            shorts: [],
            history: [watched("deleted")],
            favoriteIds: [],
        });
        expect(taste.tokens.size).toBe(0);
        expect(taste.watched.has("deleted")).toBe(true);
    });
});
