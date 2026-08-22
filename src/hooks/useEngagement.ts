import {useAtom} from "jotai";
import {useCallback, useEffect} from "react";
import {track} from "@/services/analytics";
import {engagementAtom} from "@/stores/store";

const DAY = 86_400_000;

/** A prompt may only reappear after this cooldown. */
export const PROMPT_COOLDOWN_MS = 7 * DAY;

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

    const markNotificationPromptSeen = useCallback(() => {
        setEngagement((current) => ({
            ...current,
            notificationPromptSeen: true,
        }));
    }, [setEngagement]);

    const cooledDown =
        !engagement.lastPromptAt ||
        Date.now() - engagement.lastPromptAt > PROMPT_COOLDOWN_MS;

    return {
        ...engagement,
        /** Ask for notifications only after two sessions and one real play. */
        canPromptNotifications:
            !engagement.notificationPromptSeen &&
            engagement.sessions >= 2 &&
            engagement.playsStarted >= 1,
        /** The share/community prompt waits even longer and respects a cooldown. */
        canPromptShare:
            cooledDown &&
            engagement.sessions >= 4 &&
            engagement.playsStarted >= 3,
        recordPlay,
        recordPrompt,
        recordShare,
        markNotificationPromptSeen,
    };
};
