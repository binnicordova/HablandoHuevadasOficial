import * as BackgroundTask from "expo-background-task";
import {STORAGE_ID} from "@/constants/storage";
import type {HistoryEntry, StreakState} from "@/models/video";
import {getShorts, getVideos} from "@/services/catalog";
import {
    INITIAL_NOTIFICATION_STATE,
    type NotificationState,
    nextStateAfterPlan,
    type PlannerInput,
    planNotifications,
} from "@/services/notificationPlanner";
import type {Settings} from "@/stores/store";
import {applyNotificationPlan} from "@/utils/notification";
import {storage} from "@/utils/storage";

/**
 * Rolls the notification window forward while the app is closed.
 *
 * The plan covers three days, so nothing breaks if this never runs — but a user
 * who does not open the app for a week would otherwise run out of scheduled
 * pushes exactly when the win-back copy matters most. When the OS grants a
 * window, the whole plan is rebuilt from persisted state.
 */
export const localNotificationTask = async () => {
    try {
        const settings = await storage.getItem<Settings>(STORAGE_ID.settings);
        /*
         * No stored settings means a fresh install that has not written any
         * yet. The app-level default is on, so the absence of a record is not
         * a reason to stay silent — only an explicit opt-out is.
         */
        if (settings?.notificationOptOut) {
            return BackgroundTask.BackgroundTaskResult.Success;
        }
        if (settings && !settings.dailyNotification) {
            return BackgroundTask.BackgroundTaskResult.Success;
        }

        const [state, history, favoriteIds, streak] = await Promise.all([
            storage.getItem<NotificationState>(STORAGE_ID.notifications),
            storage.getItem<HistoryEntry[]>(STORAGE_ID.history),
            storage.getItem<string[]>(STORAGE_ID.favorites),
            storage.getItem<StreakState>(STORAGE_ID.streak),
        ]);

        const input: PlannerInput = {
            now: new Date(),
            level: settings?.notificationLevel ?? "normal",
            reminderHour: settings?.reminderHour ?? 19,
            videos: getVideos(),
            shorts: getShorts(),
            history: history ?? [],
            favoriteIds: favoriteIds ?? [],
            streak: streak ?? {
                current: 0,
                best: 0,
                lastDay: null,
                totalDays: 0,
            },
            state: state ?? INITIAL_NOTIFICATION_STATE,
        };

        const plan = planNotifications(input);
        await applyNotificationPlan(plan);
        await storage.setItem(
            STORAGE_ID.notifications,
            nextStateAfterPlan(input, plan)
        );

        return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
};
