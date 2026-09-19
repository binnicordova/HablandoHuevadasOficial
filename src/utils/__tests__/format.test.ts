import {
    formatDuration,
    formatRelativeTime,
    formatViews,
    normalize,
} from "@/utils/format";

describe("format utils", () => {
    it("formats view counts", () => {
        expect(formatViews(null)).toBe("");
        expect(formatViews(950)).toBe("950 vistas");
        expect(formatViews(12_500)).toBe("12K de vistas");
        expect(formatViews(2_900_000)).toBe("2.9M de vistas");
    });

    it("formats durations", () => {
        expect(formatDuration(0)).toBe("");
        expect(formatDuration(272)).toBe("4:32");
        expect(formatDuration(4647)).toBe("1:17:27");
    });

    it("strips accents and case for search", () => {
        expect(normalize("El Niño ANTICUCHERO")).toBe("el nino anticuchero");
    });

    it("describes relative time", () => {
        expect(formatRelativeTime(Date.now())).toBe("hace un momento");
        expect(formatRelativeTime(Date.now() - 3 * 60_000)).toBe("hace 3 min");
        expect(formatRelativeTime(Date.now() - 25 * 3_600_000)).toBe("ayer");
    });
});
