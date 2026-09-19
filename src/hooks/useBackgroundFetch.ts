import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import {localNotificationTask} from "@/tasks";
import {isExpoGo} from "@/utils/notification";

const TASK_NAME = "daily-digest-refresh";
const TASK_INTERVAL_MINUTES = 60 * 12;

/**
 * Background tasks are not available in Expo Go, so registration is guarded.
 * The engagement loop does not depend on this: every push is already scheduled
 * locally three days out and fires with the app closed. This task only rolls
 * that window forward — and re-picks the clips against fresher state — when the
 * OS grants us a slot.
 *
 * The task name is kept from the previous build on purpose: renaming it would
 * strand the registration on every installed device.
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
