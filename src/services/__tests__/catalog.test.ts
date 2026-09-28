import type {CatalogItem} from "@/models/video";
import {
    getDailyPick,
    getHeroTint,
    getItemById,
    getLatestItem,
    getLatestVideo,
    getRelated,
    getShorts,
    getShuffledShorts,
    getVideos,
    isRecentlyPublished,
    searchCatalog,
} from "@/services/catalog";

describe("catalog", () => {
    it("loads videos and shorts from the bundled dataset", () => {
        expect(getVideos().length).toBeGreaterThan(0);
        expect(getShorts().length).toBeGreaterThan(0);
    });

    it("tags every item with its collection", () => {
        expect(getVideos()[0].kind).toBe("video");
        expect(getShorts()[0].kind).toBe("short");
    });

    it("rebuilds thumbnails from the video id so they never expire", () => {
        const item = getVideos()[0];
        expect(item.thumbnail).toBe(
            `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`
        );
    });

    it("returns the same pick for a given day and a different one across days", () => {
        const day1 = new Date("2026-01-01T12:00:00");
        const day2 = new Date("2026-01-02T12:00:00");
        expect(getDailyPick(day1)?.id).toBe(getDailyPick(day1)?.id);
        expect(getDailyPick(day1)?.id).not.toBe(getDailyPick(day2)?.id);
    });

    it("rotates the shorts feed per day without losing items", () => {
        const shorts = getShorts();
        const rotated = getShuffledShorts(new Date("2026-01-01T12:00:00"));
        expect(rotated).toHaveLength(shorts.length);
        expect(new Set(rotated.map((item) => item.id)).size).toBe(
            new Set(shorts.map((item) => item.id)).size
        );
    });

    it("looks items up by id", () => {
        const item = getVideos()[3];
        expect(getItemById(item.id)?.title).toBe(item.title);
        expect(getItemById("does-not-exist")).toBeUndefined();
    });

    it("matches search terms ignoring case and accents", () => {
        const target = getVideos()[0];
        const firstWord = target.title.split(" ")[0];
        const results = searchCatalog(firstWord.toLowerCase());
        expect(results.length).toBeGreaterThan(0);
    });

    it("ignores queries shorter than one term", () => {
        expect(searchCatalog("   ")).toEqual([]);
    });

    it("restricts results to the requested collection", () => {
        const results = searchCatalog("a", {kind: "short"});
        expect(results.every((item) => item.kind === "short")).toBe(true);
    });

    it("suggests related items from the same collection", () => {
        const item = getVideos()[10];
        const related = getRelated(item.id, 5);
        expect(related).toHaveLength(5);
        expect(related.every((candidate) => candidate.id !== item.id)).toBe(
            true
        );
    });

    it("prefers a video's real timestamp over its position in the list", () => {
        // Most of the bundled dataset predates these fields, but not all of
        // it — so the answer has to come from whichever entry parses to the
        // latest instant, not just "index 0".
        const at = (item: {
            premiere_at?: string;
            upload_date?: string;
            announced_at?: string;
        }) => {
            const raw =
                item.premiere_at ?? item.upload_date ?? item.announced_at;
            return raw ? Date.parse(raw) : Number.NEGATIVE_INFINITY;
        };
        const expected = getVideos().reduce((best, item) =>
            at(item) > at(best) ? item : best
        );
        expect(getLatestVideo()?.id).toBe(expected.id);
    });

    it("getLatestItem never returns something outside videos+shorts", () => {
        const ids = new Set(
            [...getVideos(), ...getShorts()].map((item) => item.id)
        );
        expect(ids.has(getLatestItem()?.id ?? "")).toBe(true);
    });
});

describe("isRecentlyPublished", () => {
    const item = (overrides: Partial<CatalogItem>): CatalogItem => ({
        id: "x",
        link: "https://www.youtube.com/watch?v=x",
        title: "x",
        view_count: 0,
        thumbnail: null,
        kind: "video",
        ...overrides,
    });

    const now = new Date("2026-03-10T12:00:00Z");

    it("is true within the window, using the real premiere clock first", () => {
        const oneDayAgo = new Date(now.getTime() - 86_400_000).toISOString();
        expect(isRecentlyPublished(item({premiere_at: oneDayAgo}), now)).toBe(
            true
        );
    });

    it("is false once the window has passed", () => {
        const fourDaysAgo = new Date(
            now.getTime() - 4 * 86_400_000
        ).toISOString();
        expect(isRecentlyPublished(item({upload_date: fourDaysAgo}), now)).toBe(
            false
        );
    });

    it("falls back to announced_at when nothing else is known yet", () => {
        const today = new Date(now.getTime() - 3_600_000).toISOString();
        expect(isRecentlyPublished(item({announced_at: today}), now)).toBe(
            true
        );
    });

    it("is false for an item with no timestamp at all", () => {
        expect(isRecentlyPublished(item({}), now)).toBe(false);
    });
});

describe("getHeroTint", () => {
    it("is null when nothing is loaded", () => {
        expect(getHeroTint(null)).toBeNull();
    });

    it("is null for a short — the hero player never shows one", () => {
        expect(getHeroTint({...getShorts()[0]})).toBeNull();
    });

    it("is premiere for a live or upcoming item regardless of recency", () => {
        // The last video in the bundled list — old, not the "latest" by any
        // measure, which is the point: live/upcoming outranks recency.
        const stale = getVideos()[getVideos().length - 1];
        expect(getHeroTint({...stale, live_status: "live"})).toBe("premiere");
        expect(getHeroTint({...stale, live_status: "upcoming"})).toBe(
            "premiere"
        );
    });

    it("is premiere for the latest video once it went through the announce flow", () => {
        const latest = getLatestVideo();
        if (!latest) throw new Error("bundled dataset has no videos");
        const announced: CatalogItem = {
            ...latest,
            live_status: undefined,
            premiere_at: new Date().toISOString(),
            announced_at: new Date().toISOString(),
        };
        expect(getHeroTint(announced)).toBe("premiere");
    });

    it("is new for the latest video with no premiere history", () => {
        const latest = getLatestVideo();
        if (!latest) throw new Error("bundled dataset has no videos");
        const fresh: CatalogItem = {
            ...latest,
            live_status: undefined,
            premiere_at: undefined,
            upload_date: new Date().toISOString(),
            announced_at: new Date().toISOString(),
        };
        expect(getHeroTint(fresh)).toBe("new");
    });

    it("is null for the latest video once its window has passed", () => {
        const latest = getLatestVideo();
        if (!latest) throw new Error("bundled dataset has no videos");
        const old: CatalogItem = {
            ...latest,
            live_status: undefined,
            premiere_at: undefined,
            announced_at: undefined,
            upload_date: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        };
        expect(getHeroTint(old)).toBeNull();
    });
});
