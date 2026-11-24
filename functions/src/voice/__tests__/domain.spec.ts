import {describe, expect, it} from "vitest";
import {checkSpeakable} from "../domain/safety";
import {decide} from "../services/limits";
import {audienceOf, headersToRecord} from "../services/tts";

describe("checkSpeakable", () => {
    it("lets normal banter through", () => {
        expect(checkSpeakable("Qué huevada, causa.").ok).toBe(true);
    });

    it("blocks endorsements and slurs, accents or not", () => {
        expect(checkSpeakable("Vota por ese candidato, pues").ok).toBe(false);
        expect(checkSpeakable("VIOLACIÓN").ok).toBe(false);
        expect(checkSpeakable("cholo de mierda").ok).toBe(false);
    });
});

describe("decide", () => {
    const config = {perMinute: 2, perDay: 3, globalPerDay: 100};

    it("applies the minute window, then the day window", () => {
        let hits: number[] = [];
        const hit = (now: number) => {
            const out = decide(hits, now, config);
            hits = out.kept;
            return out.refusal;
        };
        expect(hit(0)).toBeNull();
        expect(hit(1_000)).toBeNull();
        expect(hit(2_000)).toBe("minute");
        expect(hit(70_000)).toBeNull();
        expect(hit(140_000)).toBe("day");
    });
});

describe("audienceOf", () => {
    it("keeps the origin and drops the path", () => {
        expect(
            audienceOf("https://hh-tts-123.us-east1.run.app/synthesize")
        ).toBe("https://hh-tts-123.us-east1.run.app");
    });
});

describe("headersToRecord", () => {
    it("keeps the Authorization header from a Headers object and a plain one", () => {
        const fromHeaders = headersToRecord(
            new Headers({Authorization: "Bearer t"})
        );
        expect(fromHeaders.authorization).toBe("Bearer t");
        expect(headersToRecord({Authorization: "Bearer t"}).Authorization).toBe(
            "Bearer t"
        );
    });
});
