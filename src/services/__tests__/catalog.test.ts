import {
    getDailyPick,
    getItemById,
    getRelated,
    getShorts,
    getShuffledShorts,
    getVideos,
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
});
