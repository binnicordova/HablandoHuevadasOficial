import {useAtom} from "jotai";
import {useEffect} from "react";
import {track} from "@/services/analytics";
import {streakAtom} from "@/stores/store";
import {dayKey, daysBetween} from "@/utils/date";

/** Milestones that unlock a share prompt and a badge in "Mi zona". */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export const nextMilestone = (current: number): number =>
    STREAK_MILESTONES.find((milestone) => milestone > current) ??
    STREAK_MILESTONES[STREAK_MILESTONES.length - 1];

export const isMilestone = (current: number): boolean =>
    STREAK_MILESTONES.includes(current);

/**
 * Credits one day to the streak per calendar day. A gap of exactly one day
 * continues the run, anything larger resets it to 1.
 */
let creditedThisLaunch = false;

export const useStreak = () => {
    const [streak, setStreak] = useAtom(streakAtom);

    useEffect(() => {
        if (creditedThisLaunch) return;
        creditedThisLaunch = true;

        const today = dayKey();
        setStreak((current) => {
            if (current.lastDay === today) return current;
            const gap = current.lastDay
                ? daysBetween(current.lastDay, today)
                : null;
            const next = gap === 1 ? current.current + 1 : 1;
            track({name: "streak_day", streak: next});
            return {
                current: next,
                best: Math.max(current.best, next),
                lastDay: today,
                totalDays: current.totalDays + 1,
            };
        });
    }, [setStreak]);

    return {
        streak: streak.current,
        best: streak.best,
        totalDays: streak.totalDays,
        nextMilestone: nextMilestone(streak.current),
        atMilestone: isMilestone(streak.current),
    };
};
