import {
    canAskForNotifications,
    NOTIFICATION_PROMPT_COOLDOWN_MS,
    NOTIFICATION_PROMPT_LIMIT,
} from "@/hooks/useEngagement";

const NOW = Date.UTC(2026, 2, 4, 12);

const engagement = (overrides = {}) => ({
    notificationPromptSeen: false,
    ...overrides,
});

describe("notification prompt gate", () => {
    it("asks on the very first session, before anything is watched", () => {
        expect(canAskForNotifications(engagement(), NOW)).toBe(true);
    });

    it("rests between asks instead of giving up after one", () => {
        const justAsked = engagement({
            notificationPromptCount: 1,
            notificationPromptAt: NOW - 1000,
        });
        expect(canAskForNotifications(justAsked, NOW)).toBe(false);

        const rested = engagement({
            notificationPromptCount: 1,
            notificationPromptAt: NOW - NOTIFICATION_PROMPT_COOLDOWN_MS - 1000,
        });
        expect(canAskForNotifications(rested, NOW)).toBe(true);
    });

    it("stops for good once the limit is spent", () => {
        const spent = engagement({
            notificationPromptCount: NOTIFICATION_PROMPT_LIMIT,
            notificationPromptAt: NOW - NOTIFICATION_PROMPT_COOLDOWN_MS * 10,
        });
        expect(canAskForNotifications(spent, NOW)).toBe(false);
    });

    /*
     * Settings are persisted wholesale rather than merged, so an install from
     * before the counter existed arrives with only the old boolean.
     */
    it("counts a legacy one-shot dismissal as a single ask, not a tombstone", () => {
        const legacy = engagement({notificationPromptSeen: true});
        expect(canAskForNotifications(legacy, NOW)).toBe(true);

        const legacyJustAsked = engagement({
            notificationPromptSeen: true,
            notificationPromptAt: NOW - 1000,
        });
        expect(canAskForNotifications(legacyJustAsked, NOW)).toBe(false);
    });
});
