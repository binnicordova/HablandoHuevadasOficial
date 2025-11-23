import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import {localNotificationTask} from "@/tasks";

const TASK_NAME = "local-notification";
const TASK_INTERVAL = 60 * 60 * 24;
const TASK_CONFIGURATION = {minimumInterval: TASK_INTERVAL};

TaskManager.defineTask(TASK_NAME, localNotificationTask);

export const initBackgroundFetch = async () => {
    await BackgroundTask.registerTaskAsync(TASK_NAME, TASK_CONFIGURATION);
};
