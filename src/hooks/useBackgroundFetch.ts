import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import {localNotificationTask} from "@/tasks";
import {isExpoGo} from "@/utils/notification";

const TASK_NAME = "daily-digest-refresh";
const TASK_INTERVAL_MINUTES = 60 * 12;

/**
 * Background tasks are not available in Expo Go, so registration is guarded.
 * The engagement loop does not depend on this: the daily digest is a local
 * DAILY trigger that fires with the app closed. This task only refreshes the
 * digest copy with a fresh pick when the OS grants us a window.
 */
export const initBackgroundFetch = async () => {
    if (isExpoGo) return;
    try {
        if (!TaskManager.isTaskDefined(TASK_NAME)) {
            TaskManager.defineTask(TASK_NAME, localNotificationTask);
        }
        const status = await BackgroundTask.getStatusAsync();
        if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
        await BackgroundTask.registerTaskAsync(TASK_NAME, {
            minimumInterval: TASK_INTERVAL_MINUTES,
        });
    } catch {
        /* the OS refused registration; the local DAILY trigger still runs */
    }
};
