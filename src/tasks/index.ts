import * as BackgroundTask from "expo-background-task";
import {scheduleLocalNotification} from "@/utils/notification";

export const localNotificationTask = async () => {
    scheduleLocalNotification(
        "Hello There!",
        "This is a test notification.",
        {}
    );
    return BackgroundTask.BackgroundTaskResult.Success;
};
