import {dayKey, daysBetween, hashString} from "@/utils/date";

describe("date utils", () => {
    it("formats a local calendar day", () => {
        expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
        expect(dayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
    });

    it("counts whole days between two keys", () => {
        expect(daysBetween("2026-01-01", "2026-01-02")).toBe(1);
        expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
        expect(daysBetween("2026-01-01", "2026-02-01")).toBe(31);
    });

    it("survives a daylight saving transition", () => {
        expect(daysBetween("2026-03-28", "2026-03-29")).toBe(1);
    });

    it("hashes deterministically", () => {
        expect(hashString("abc")).toBe(hashString("abc"));
        expect(hashString("abc")).not.toBe(hashString("abd"));
    });
});
