import {
    type AnalyticsRecord,
    getBufferedEvents,
    setAnalyticsSink,
    track,
} from "@/services/analytics";

describe("analytics", () => {
    afterEach(() => {
        setAnalyticsSink(null);
    });

    it("buffers events while no sink is installed", () => {
        track({name: "app_open", sessions: 1});
        expect(getBufferedEvents().some((e) => e.name === "app_open")).toBe(
            true
        );
    });

    it("flushes the buffer when a sink is installed and forwards later events", () => {
        track({name: "notification_prompt_shown"});

        const received: AnalyticsRecord[] = [];
        setAnalyticsSink((event) => received.push(event));
        expect(
            received.some((e) => e.name === "notification_prompt_shown")
        ).toBe(true);
        expect(getBufferedEvents()).toHaveLength(0);

        track({name: "notification_opt_in", granted: true});
        expect(received[received.length - 1]).toMatchObject({
            name: "notification_opt_in",
            granted: true,
        });
    });

    it("stamps every record with a timestamp", () => {
        const received: AnalyticsRecord[] = [];
        setAnalyticsSink((event) => received.push(event));
        track({name: "streak_day", streak: 4});
        expect(typeof received[received.length - 1].at).toBe("number");
    });
});
