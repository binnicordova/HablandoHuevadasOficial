import Constants, {ExecutionEnvironment} from "expo-constants";
import * as Notifications from "expo-notifications";
import {Platform} from "react-native";
import {COPY} from "@/constants/copy";
import type {PlannedNotification} from "@/services/notificationPlanner";
import {theme} from "@/theme/colors";

export const ANDROID_CHANNEL_ID = "default";

/**
 * Expo Go cannot deliver remote push (Android, SDK 53+) and has no background
 * task runner, but local scheduled notifications work everywhere. The whole
 * engagement strategy is therefore built on local notifications only.
 */
export const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Every id this app schedules starts with this. */
export const NOTIFICATION_PREFIX = "hh-";

let handlerRegistered = false;

export const registerNotificationHandler = () => {
    if (handlerRegistered) return;
    handlerRegistered = true;
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
};

export const ensureAndroidChannel = async () => {
    if (Platform.OS !== "android") return;
    try {
        await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
            name: COPY.appName,
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: theme().accent,
        });
    } catch {
        /* channel creation is best effort */
    }
};

export const getPermissionStatus =
    async (): Promise<Notifications.PermissionStatus> => {
        try {
            const {status} = await Notifications.getPermissionsAsync();
            return status;
        } catch {
            return Notifications.PermissionStatus.UNDETERMINED;
        }
    };

/**
 * Only ever called from an explicit user tap on the in-app opt-in card, never on
 * cold start. Asking before showing value is the single biggest cause of a
 * permanently denied permission.
 */
export const requestPermission = async (): Promise<boolean> => {
    try {
        await ensureAndroidChannel();
        const existing = await getPermissionStatus();
        if (existing === Notifications.PermissionStatus.GRANTED) return true;
        const {status} = await Notifications.requestPermissionsAsync();
        return status === Notifications.PermissionStatus.GRANTED;
    } catch {
        return false;
    }
};

export const cancelAllScheduled = async () => {
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
        /* nothing scheduled */
    }
};

/**
 * Replaces the whole schedule with a freshly planned one.
 *
 * Wholesale replacement rather than diffing: the plan is rebuilt on every
 * launch from live state (streak, history, back-off), so yesterday's pending
 * notifications are stale by definition, and a partial update is how you end up
 * with two "huevada del día" firing an hour apart.
 */
export const applyNotificationPlan = async (
    plan: PlannedNotification[]
): Promise<number> => {
    await ensureAndroidChannel();
    await cancelAllScheduled();

    let scheduled = 0;
    for (const entry of plan) {
        // The OS silently drops a past date, so anything that slipped between
        // planning and applying is skipped here instead of vanishing quietly.
        if (entry.fireAt <= Date.now() + 30_000) continue;
        try {
            await Notifications.scheduleNotificationAsync({
                identifier: entry.id,
                content: {
                    title: entry.title,
                    body: entry.body,
                    data: entry.data,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: new Date(entry.fireAt),
                    channelId: ANDROID_CHANNEL_ID,
                },
            });
            scheduled += 1;
        } catch {
            /* one bad entry must not take the rest of the plan down */
        }
    }
    return scheduled;
};

/** Debug helper: what the OS is actually holding for us right now. */
export const getScheduled = async () => {
    try {
        return await Notifications.getAllScheduledNotificationsAsync();
    } catch {
        return [];
    }
};

/** Kept for callers that need an immediate local notification. */
export const scheduleLocalNotification = async (
    title: string,
    body: string,
    data: {[key: string]: unknown} = {}
) =>
    Notifications.scheduleNotificationAsync({
        content: {title, body, data},
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            channelId: ANDROID_CHANNEL_ID,
            seconds: 2,
            repeats: false,
        },
    });
