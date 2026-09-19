import {
    getYoutubeVideoId,
    isValidVideoId,
    thumbnailUrl,
    watchUrl,
} from "@/utils/youtube";

describe("youtube utils", () => {
    it("extracts ids from every URL shape in the dataset", () => {
        expect(
            getYoutubeVideoId("https://www.youtube.com/watch?v=UOGCSLbFIkE")
        ).toBe("UOGCSLbFIkE");
        expect(
            getYoutubeVideoId("https://www.youtube.com/shorts/CdMcfiEpWRw")
        ).toBe("CdMcfiEpWRw");
        expect(getYoutubeVideoId("https://youtu.be/CdMcfiEpWRw")).toBe(
            "CdMcfiEpWRw"
        );
        expect(
            getYoutubeVideoId(
                "https://www.youtube.com/watch?list=X&v=UOGCSLbFIkE"
            )
        ).toBe("UOGCSLbFIkE");
    });

    it("returns null for anything that is not a YouTube URL", () => {
        expect(getYoutubeVideoId("https://example.com")).toBeNull();
        expect(getYoutubeVideoId(null)).toBeNull();
    });

    it("builds stable thumbnail and watch URLs", () => {
        expect(thumbnailUrl("UOGCSLbFIkE")).toBe(
            "https://i.ytimg.com/vi/UOGCSLbFIkE/hqdefault.jpg"
        );
        expect(watchUrl("CdMcfiEpWRw", "short")).toBe(
            "https://www.youtube.com/shorts/CdMcfiEpWRw"
        );
    });

    it("validates ids", () => {
        expect(isValidVideoId("UOGCSLbFIkE")).toBe(true);
        expect(isValidVideoId("short")).toBe(false);
        expect(isValidVideoId(undefined)).toBe(false);
    });
});
