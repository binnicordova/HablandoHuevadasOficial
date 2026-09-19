import {useAtom} from "jotai";
import {useCallback, useEffect} from "react";
import {track} from "@/services/analytics";
import {engagementAtom} from "@/stores/store";

const DAY = 86_400_000;

/** A prompt may only reappear after this cooldown. */
export const PROMPT_COOLDOWN_MS = 7 * DAY;

/**
 * The notification card rests between asks and gives up after three.
 *
 * It used to be a single shot, tombstoned on dismissal: one stray tap on the
 * close button and that install could never be reached again. Three spaced
 * asks is the difference between respecting a "no" and never hearing a "yes".
 */
export const NOTIFICATION_PROMPT_LIMIT = 3;
export const NOTIFICATION_PROMPT_COOLDOWN_MS = 3 * DAY;

/**
 * Prompts already spent on this install.
 *
 * The counter is newer than the flag it replaces, and settings are persisted
 * wholesale rather than merged, so an install from before it existed has no
 * counter at all — only the old boolean. That counts as one ask spent.
 */
type PromptHistory = {
    notificationPromptCount?: number;
    notificationPromptAt?: number | null;
    notificationPromptSeen: boolean;
};

const promptsSpent = (engagement: PromptHistory): number =>
    engagement.notificationPromptCount ??
    (engagement.notificationPromptSeen ? 1 : 0);

/**
 * Whether the notification card may be shown right now.
 *
 * Asked from the very first session. Waiting for two sessions and a play is the
 * textbook way to protect the one-shot OS prompt, and it also meant most
 * installs were never asked at all, because most installs never come back for a
 * second session. This is a soft ask — it does not open the system dialog, it
 * sits inside the feed — so the cost of asking early is a card someone scrolls
 * past, and the cost of asking late is an install we can never reach again.
 */
export const canAskForNotifications = (
    engagement: PromptHistory,
    now: number = Date.now()
): boolean => {
    if (promptsSpent(engagement) >= NOTIFICATION_PROMPT_LIMIT) return false;
    const last = engagement.notificationPromptAt ?? null;
    return last === null || now - last > NOTIFICATION_PROMPT_COOLDOWN_MS;
};

/**
 * Session and play counters that gate every interruption in the app. Nothing
 * is allowed to block the first session: prompts wait until the user has
 * actually watched something.
 */
let countedThisLaunch = false;

export const useEngagement = () => {
    const [engagement, setEngagement] = useAtom(engagementAtom);

    useEffect(() => {
        if (countedThisLaunch) return;
        countedThisLaunch = true;
        setEngagement((current) => {
            track({name: "app_open", sessions: current.sessions + 1});
            return {
                ...current,
                sessions: current.sessions + 1,
                firstOpenAt: current.firstOpenAt ?? Date.now(),
            };
        });
    }, [setEngagement]);

    const recordPlay = useCallback(() => {
        setEngagement((current) => ({
            ...current,
            playsStarted: current.playsStarted + 1,
        }));
    }, [setEngagement]);

    const recordPrompt = useCallback(() => {
        setEngagement((current) => ({...current, lastPromptAt: Date.now()}));
    }, [setEngagement]);

    const recordShare = useCallback(() => {
        setEngagement((current) => ({...current, lastShareAt: Date.now()}));
    }, [setEngagement]);

    /** One ask spent, whether it ended in a yes, a no or a dismissal. */
    const recordNotificationPrompt = useCallback(() => {
        setEngagement((current) => ({
            ...current,
            notificationPromptSeen: true,
            notificationPromptCount: promptsSpent(current) + 1,
            notificationPromptAt: Date.now(),
        }));
    }, [setEngagement]);

    const cooledDown =
        !engagement.lastPromptAt ||
        Date.now() - engagement.lastPromptAt > PROMPT_COOLDOWN_MS;

    return {
        ...engagement,
        canPromptNotifications: canAskForNotifications(engagement),
        /** The share/community prompt waits even longer and respects a cooldown. */
        canPromptShare:
            cooledDown &&
            engagement.sessions >= 4 &&
            engagement.playsStarted >= 3,
        recordPlay,
        recordPrompt,
        recordShare,
        recordNotificationPrompt,
    };
};
