import {isMilestone, nextMilestone} from "@/hooks/useStreak";

describe("streak milestones", () => {
    it("reports the next milestone above the current streak", () => {
        expect(nextMilestone(0)).toBe(3);
        expect(nextMilestone(3)).toBe(7);
        expect(nextMilestone(29)).toBe(30);
    });

    it("caps at the last milestone", () => {
        expect(nextMilestone(500)).toBe(100);
    });

    it("recognises milestone days", () => {
        expect(isMilestone(7)).toBe(true);
        expect(isMilestone(8)).toBe(false);
    });
});
