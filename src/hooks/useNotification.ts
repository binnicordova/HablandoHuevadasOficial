import * as Notifications from "expo-notifications";
import {router} from "expo-router";
import {useAtom, useAtomValue} from "jotai";
import {useCallback, useEffect} from "react";
import {Alert, Linking} from "react-native";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {track} from "@/services/analytics";
import {getDailyPick} from "@/services/catalog";
import {settingsAtom, streakAtom} from "@/stores/store";
import {
    cancelAllScheduled,
    ensureAndroidChannel,
    getPermissionStatus,
    NOTIFICATION_IDS,
    registerNotificationHandler,
    requestPermission,
    scheduleComeback,
    scheduleDailyDigest,
    scheduleStreakReminder,
} from "@/utils/notification";

type NotificationData = {
    videoId?: string;
    url?: string;
    intent?: string;
};

const routeFromData = (data: NotificationData | undefined) => {
    if (!data) return;
    track({name: "notification_opened", intent: data.intent ?? "daily"});
    if (data.videoId) {
        router.push(PATHS.VIDEO(data.videoId));
        return;
    }
    if (data.url) {
        router.push(PATHS.WEB(data.url, COPY.appName));
        return;
    }
    router.push(PATHS.HOME);
};

/**
 * Registers the notification handler, the Android channel and the tap router.
 *
 * Mount this exactly once, from the root layout. Registering the response
 * listener per consumer would route a single tap once per mounted hook.
 */
export const useNotificationRouting = () => {
    useEffect(() => {
        registerNotificationHandler();
        ensureAndroidChannel();
    }, []);

    useEffect(() => {
        const responseSub =
            Notifications.addNotificationResponseReceivedListener(
                (response) => {
                    routeFromData(
                        response.notification.request.content.data as
                            | NotificationData
                            | undefined
                    );
                }
            );

        // Cold start from a notification tap.
        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (!response) return;
                routeFromData(
                    response.notification.request.content.data as
                        | NotificationData
                        | undefined
                );
            })
            .catch(() => {});

        return () => {
            responseSub.remove();
        };
    }, []);
};

/**
 * Notification settings and scheduling. Safe to mount from any screen: the
 * re-arm effect is guarded to run once per launch, and nothing here registers
 * a listener.
 *
 * It never requests permission on its own. `enable()` is called from the opt-in
 * card, after the user has already watched something.
 */
let syncedThisLaunch = false;

export const useNotifications = () => {
    const [settings, setSettings] = useAtom(settingsAtom);
    const streak = useAtomValue(streakAtom);

    // Re-arm the rolling reminders once per launch.
    useEffect(() => {
        if (syncedThisLaunch) return;
        syncedThisLaunch = true;

        const sync = async () => {
            const status = await getPermissionStatus();
            if (status !== Notifications.PermissionStatus.GRANTED) return;
            if (!settings.dailyNotification) return;
            await scheduleDailyDigest(settings.reminderHour, getDailyPick());
            await scheduleStreakReminder(streak.current);
            await scheduleComeback();
        };
        sync();
    }, [settings.dailyNotification, settings.reminderHour, streak.current]);

    const enable = useCallback(async (): Promise<boolean> => {
        const granted = await requestPermission();
        track({name: "notification_opt_in", granted});
        if (!granted) {
            Alert.alert(
                COPY.notification.blockedTitle,
                COPY.notification.blockedBody,
                [
                    {text: COPY.notification.optInDismiss, style: "cancel"},
                    {
                        text: COPY.notification.blockedAction,
                        onPress: () => Linking.openSettings(),
                    },
                ]
            );
            return false;
        }
        setSettings((current) => ({...current, dailyNotification: true}));
        await scheduleDailyDigest(settings.reminderHour, getDailyPick());
        await scheduleStreakReminder(streak.current);
        await scheduleComeback();
        return true;
    }, [setSettings, settings.reminderHour, streak.current]);

    const disable = useCallback(async () => {
        setSettings((current) => ({...current, dailyNotification: false}));
        await cancelAllScheduled();
    }, [setSettings]);

    const setReminderHour = useCallback(
        async (hour: number) => {
            setSettings((current) => ({...current, reminderHour: hour}));
            if (settings.dailyNotification) {
                await scheduleDailyDigest(hour, getDailyPick());
            }
        },
        [setSettings, settings.dailyNotification]
    );

    return {
        enabled: settings.dailyNotification,
        reminderHour: settings.reminderHour,
        enable,
        disable,
        setReminderHour,
        ids: NOTIFICATION_IDS,
    };
};
