import Constants, {ExecutionEnvironment} from "expo-constants";
import * as Notifications from "expo-notifications";
import {Platform} from "react-native";
import {COPY} from "@/constants/copy";
import type {CatalogItem} from "@/models/video";
import {getDailyPick} from "@/services/catalog";
import {theme} from "@/theme/colors";

export const ANDROID_CHANNEL_ID = "default";

/**
 * Expo Go cannot deliver remote push (Android, SDK 53+) and has no background
 * task runner, but local scheduled notifications work everywhere. The whole
 * engagement strategy is therefore built on local notifications only.
 */
export const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const NOTIFICATION_IDS = {
    daily: "hh-daily-digest",
    streak: "hh-streak-reminder",
    comeback: "hh-comeback",
} as const;

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

const cancel = async (identifier: string) => {
    try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {
        /* nothing scheduled under that id */
    }
};

/** Daily "huevada del día" at the user's chosen hour. */
export const scheduleDailyDigest = async (
    hour: number,
    item?: CatalogItem | null
) => {
    await cancel(NOTIFICATION_IDS.daily);
    const pick = item ?? getDailyPick();
    await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_IDS.daily,
        content: {
            title: COPY.notification.dailyTitle,
            body: pick?.title ?? COPY.notification.dailyFallback,
            data: pick ? {videoId: pick.id, kind: pick.kind} : {},
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute: 0,
            channelId: ANDROID_CHANNEL_ID,
        },
    });
};

/**
 * Fires ~20h after the last open. Rescheduled on every launch, so it only ever
 * reaches users who actually stopped coming back.
 */
export const scheduleStreakReminder = async (currentStreak: number) => {
    await cancel(NOTIFICATION_IDS.streak);
    if (currentStreak < 2) return;
    await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_IDS.streak,
        content: {
            title: COPY.notification.streakTitle,
            body: COPY.notification.streakBody(currentStreak),
            data: {intent: "streak"},
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 60 * 60 * 20,
            repeats: false,
            channelId: ANDROID_CHANNEL_ID,
        },
    });
};

/** Win-back nudge three days out, also rescheduled on every launch. */
export const scheduleComeback = async () => {
    await cancel(NOTIFICATION_IDS.comeback);
    await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_IDS.comeback,
        content: {
            title: COPY.notification.comebackTitle,
            body: COPY.notification.comebackBody,
            data: {intent: "comeback"},
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 60 * 60 * 24 * 3,
            repeats: false,
            channelId: ANDROID_CHANNEL_ID,
        },
    });
};

export const cancelAllScheduled = async () => {
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
    } catch {
        /* nothing scheduled */
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
