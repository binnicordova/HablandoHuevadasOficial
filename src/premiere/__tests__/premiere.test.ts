import type {CatalogItem} from "@/models/video";
import {
    getPremiereState,
    getUpcomingPremiere,
    isPlayable,
    PREMIERE_LIVE_GRACE_MS,
} from "@/premiere/domain/premiere";

const NOW = Date.parse("2026-11-08T19:00:00-05:00");
const MIN = 60_000;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const video = (id: string, extra: Partial<CatalogItem> = {}): CatalogItem => ({
    id,
    link: `https://www.youtube.com/watch?v=${id}`,
    title: id,
    view_count: null,
    thumbnail: null,
    kind: "video",
    ...extra,
});

describe("getPremiereState", () => {
    it("treats an ordinary video as released", () => {
        expect(getPremiereState({}, NOW)).toEqual({phase: "released"});
    });

    it("is scheduled while the start is more than ten minutes away", () => {
        const state = getPremiereState({premiere_at: at(2 * 60 * MIN)}, NOW);
        expect(state).toEqual({
            phase: "scheduled",
            at: NOW + 120 * MIN,
            remainingMs: 120 * MIN,
        });
    });

    it("turns imminent exactly at the ten minute mark", () => {
        expect(
            getPremiereState({premiere_at: at(10 * MIN + 1)}, NOW).phase
        ).toBe("scheduled");
        expect(getPremiereState({premiere_at: at(10 * MIN)}, NOW).phase).toBe(
            "imminent"
        );
    });

    it("is live from the scheduled instant while the data still says upcoming", () => {
        const item = {live_status: "upcoming" as const, premiere_at: at(0)};
        expect(getPremiereState(item, NOW)).toEqual({phase: "live", at: NOW});
    });

    it("stops claiming live once the grace window is over", () => {
        const item = {
            live_status: "upcoming" as const,
            premiere_at: at(-PREMIERE_LIVE_GRACE_MS),
        };
        expect(getPremiereState(item, NOW)).toEqual({phase: "released"});
    });

    it("is released once the data no longer flags it", () => {
        expect(getPremiereState({premiere_at: at(-MIN)}, NOW)).toEqual({
            phase: "released",
        });
    });

    it("is live when the dataset says so, with or without a time", () => {
        expect(getPremiereState({live_status: "live"}, NOW)).toEqual({
            phase: "live",
            at: null,
        });
    });

    it("has an unknown time when upcoming without a usable premiere_at", () => {
        expect(getPremiereState({live_status: "upcoming"}, NOW)).toEqual({
            phase: "unknown-time",
        });
        expect(
            getPremiereState(
                {live_status: "upcoming", premiere_at: "garbage"},
                NOW
            )
        ).toEqual({phase: "unknown-time"});
    });

    it("never throws on an invalid date alone", () => {
        expect(getPremiereState({premiere_at: "nope"}, NOW)).toEqual({
            phase: "released",
        });
    });
});

describe("isPlayable", () => {
    it("only lets released and live episodes reach the player", () => {
        expect(isPlayable({phase: "released"})).toBe(true);
        expect(isPlayable({phase: "live", at: NOW})).toBe(true);
        expect(isPlayable({phase: "unknown-time"})).toBe(false);
        expect(
            isPlayable({phase: "scheduled", at: NOW + MIN, remainingMs: MIN})
        ).toBe(false);
    });
});

describe("getUpcomingPremiere", () => {
    it("returns null when everything has aired", () => {
        expect(getUpcomingPremiere([video("a"), video("b")], NOW)).toBeNull();
    });

    it("picks the soonest scheduled premiere", () => {
        const found = getUpcomingPremiere(
            [
                video("late", {premiere_at: at(5 * 60 * MIN)}),
                video("soon", {premiere_at: at(30 * MIN)}),
            ],
            NOW
        );
        expect(found?.item.id).toBe("soon");
    });

    it("ranks live ahead of scheduled, and unknown time last", () => {
        const live = video("live", {live_status: "live"});
        const scheduled = video("sched", {premiere_at: at(30 * MIN)});
        const unknown = video("unk", {live_status: "upcoming"});
        expect(
            getUpcomingPremiere([unknown, scheduled, live], NOW)?.item.id
        ).toBe("live");
        expect(getUpcomingPremiere([unknown, scheduled], NOW)?.item.id).toBe(
            "sched"
        );
        expect(getUpcomingPremiere([unknown], NOW)?.item.id).toBe("unk");
    });

    it("ignores shorts", () => {
        const short = video("s", {kind: "short", live_status: "upcoming"});
        expect(getUpcomingPremiere([short], NOW)).toBeNull();
    });
});
