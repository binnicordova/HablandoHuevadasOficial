import {formatCountdown, toCountdown} from "@/premiere/domain/countdown";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("toCountdown", () => {
    it("splits a duration into days, hours, minutes and seconds", () => {
        expect(toCountdown(DAY + 2 * HOUR + 3 * MIN + 4 * SEC)).toEqual({
            days: 1,
            hours: 2,
            minutes: 3,
            seconds: 4,
            totalSeconds: 93_784,
        });
    });

    it("rounds partial seconds up so it never reads zero early", () => {
        expect(toCountdown(1).totalSeconds).toBe(1);
        expect(toCountdown(1001).totalSeconds).toBe(2);
    });

    it("clamps negative time to zero", () => {
        expect(toCountdown(-5000).totalSeconds).toBe(0);
    });
});

describe("formatCountdown", () => {
    const label = (ms: number) => formatCountdown(toCountdown(ms));

    it("shows days and hours when more than a day away", () => {
        expect(label(2 * DAY + 3 * HOUR + 59 * MIN)).toBe("2d 3h");
    });

    it("shows hours and minutes under a day", () => {
        expect(label(HOUR + 52 * MIN + 30 * SEC)).toBe("1h 52m");
    });

    it("drops seconds until the last ten minutes", () => {
        expect(label(42 * MIN + 17 * SEC)).toBe("42m");
        expect(label(10 * MIN + SEC)).toBe("10m");
    });

    it("adds zero-padded seconds from ten minutes out", () => {
        expect(label(10 * MIN)).toBe("10m 00s");
        expect(label(9 * MIN + 41 * SEC)).toBe("9m 41s");
        expect(label(5 * SEC)).toBe("0m 05s");
    });

    it("keeps the same text within one minute outside the final stretch", () => {
        expect(label(HOUR + 52 * MIN + 59 * SEC)).toBe(
            label(HOUR + 52 * MIN + 1 * SEC)
        );
    });
});
