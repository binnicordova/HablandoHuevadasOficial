import * as BackgroundTask from "expo-background-task";
import {STORAGE_ID} from "@/constants/storage";
import {getDailyPick} from "@/services/catalog";
import type {Settings} from "@/stores/store";
import {scheduleDailyDigest} from "@/utils/notification";
import {storage} from "@/utils/storage";

/**
 * Rewrites the scheduled daily digest so its body always names the clip of the
 * current day instead of a stale title.
 */
export const localNotificationTask = async () => {
    try {
        const settings = await storage.getItem<Settings>(STORAGE_ID.settings);
        if (!settings?.dailyNotification) {
            return BackgroundTask.BackgroundTaskResult.Success;
        }
        await scheduleDailyDigest(settings.reminderHour ?? 19, getDailyPick());
        return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
    }
};
