import * as Notifications from "expo-notifications";
import {router} from "expo-router";
import {useAtom, useAtomValue, useSetAtom, useStore} from "jotai";
import {useCallback, useEffect} from "react";
import {Alert, Linking} from "react-native";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {track} from "@/services/analytics";
import {getShorts, getVideos} from "@/services/catalog";
import {
    type NotificationLevel,
    type NotificationSlot,
    nextStateAfterPlan,
    type PlannerInput,
    planNotifications,
    pushesPerDay,
} from "@/services/notificationPlanner";
import {
    ensureNotificationSaltAtom,
    favoriteIdsAtom,
    historyAtom,
    notificationPermissionAtom,
    notificationStateAtom,
    recordNotificationOpenAtom,
    type Settings,
    settingsAtom,
    streakAtom,
} from "@/stores/store";
import {
    applyNotificationPlan,
    cancelAllScheduled,
    ensureAndroidChannel,
    getPermissionStatus,
    registerNotificationHandler,
    requestPermission,
} from "@/utils/notification";

type NotificationData = {
    videoId?: string;
    url?: string;
    intent?: string;
    slot?: NotificationSlot;
};

/**
 * Registers the notification handler, the Android channel and the tap router.
 *
 * Mount this exactly once, from the root layout. Registering the response
 * listener per consumer would route a single tap once per mounted hook.
 */
export const useNotificationRouting = () => {
    const recordOpen = useSetAtom(recordNotificationOpenAtom);

    useEffect(() => {
        registerNotificationHandler();
        ensureAndroidChannel();
    }, []);

    const routeFromData = useCallback(
        (data: NotificationData | undefined) => {
            if (!data) return;
            track({
                name: "notification_opened",
                intent: data.intent ?? "daily",
            });
            // The tap is the only feedback this channel gets. It moves the slot
            // ranking and resets the back-off, so the schedule converges on the
            // hours this particular user answers.
            recordOpen(data.slot);

            if (data.videoId) {
                router.push(PATHS.VIDEO(data.videoId));
                return;
            }
            if (data.url) {
                router.push(PATHS.WEB(data.url, COPY.appName));
                return;
            }
            router.push(PATHS.HOME);
        },
        [recordOpen]
    );

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
    }, [routeFromData]);
};

/**
 * Notification settings and scheduling.
 *
 * Safe to mount anywhere: the launch work is guarded to run once and nothing
 * here registers a listener. It never shows the system permission dialog on its
 * own — that only happens inside `enable()`, from an explicit tap.
 *
 * The catalog is read through `getVideos()` rather than an atom on purpose.
 * This hook is mounted from the root layout so the schedule is re-armed however
 * the app was opened, and subscribing to the catalog there would drag the 3.3MB
 * dataset parse onto the cold-start render path. Inside the async effect it
 * lands after the first paint, and the bundled data never changes anyway.
 */
let bootstrappedThisLaunch = false;

export const useNotifications = () => {
    const [settings, setSettings] = useAtom(settingsAtom);
    const [notificationState, setNotificationState] = useAtom(
        notificationStateAtom
    );
    const ensureSalt = useSetAtom(ensureNotificationSaltAtom);
    const [permission, setPermission] = useAtom(notificationPermissionAtom);
    const store = useStore();

    /*
     * Subscribed but not read: mounting is what starts hydration, and the
     * planner needs these filled in from storage before it can pick anything
     * that matches this user. The values themselves are read off the store at
     * call time so a plan is never built from a render-time snapshot.
     */
    useAtomValue(streakAtom);
    useAtomValue(historyAtom);
    useAtomValue(favoriteIdsAtom);

    /**
     * Rebuilds and re-arms the whole schedule from an explicit settings
     * snapshot. Cheap enough to run on every launch and after every settings
     * change — a few thousand comparisons over an already-loaded catalog.
     *
     * It takes a snapshot instead of reading `settings` so a toggle can plan
     * with its new value immediately, without waiting for the next render.
     */
    const replanWith = useCallback(
        async (snapshot: Settings) => {
            if (!snapshot.dailyNotification) {
                await cancelAllScheduled();
                return 0;
            }
            const status = await getPermissionStatus();
            if (status !== Notifications.PermissionStatus.GRANTED) return 0;

            const input: PlannerInput = {
                now: new Date(),
                level: snapshot.notificationLevel,
                reminderHour: snapshot.reminderHour,
                videos: getVideos(),
                shorts: getShorts(),
                history: store.get(historyAtom),
                favoriteIds: store.get(favoriteIdsAtom),
                streak: store.get(streakAtom),
                state: ensureSalt() ?? store.get(notificationStateAtom),
            };

            const plan = planNotifications(input);
            const scheduled = await applyNotificationPlan(plan);
            setNotificationState(nextStateAfterPlan(input, plan));
            return scheduled;
        },
        [ensureSalt, setNotificationState, store]
    );

    const replan = useCallback(
        () => replanWith(settings),
        [replanWith, settings]
    );

    /**
     * Once per launch: read the real permission state, adopt it, and re-arm.
     *
     * Adopting matters more than it looks. A user who granted the permission on
     * an older build, or anyone on Android 12 and below where the OS grants it
     * at install, would otherwise sit at `dailyNotification: false` forever —
     * permission in hand and nothing ever scheduled. The only thing that blocks
     * the adoption is a deliberate opt-out.
     */
    useEffect(() => {
        if (bootstrappedThisLaunch) return;
        bootstrappedThisLaunch = true;

        (async () => {
            // Never write settings before storage has been read back, or the
            // defaults land on top of whatever this user had chosen.
            await Promise.all([
                settingsAtom.hydrated,
                historyAtom.hydrated,
                favoriteIdsAtom.hydrated,
                streakAtom.hydrated,
                notificationStateAtom.hydrated,
            ]);

            const status = await getPermissionStatus();
            const granted = status === Notifications.PermissionStatus.GRANTED;
            setPermission(granted ? "granted" : "denied");

            const stored = store.get(settingsAtom);

            if (granted && !stored.dailyNotification) {
                if (stored.notificationOptOut) return;
                const next = {...stored, dailyNotification: true};
                setSettings(next);
                await replanWith(next);
                return;
            }
            await replanWith(stored);
        })();
    }, [replanWith, setPermission, setSettings, store]);

    const enable = useCallback(async (): Promise<boolean> => {
        const granted = await requestPermission();
        track({name: "notification_opt_in", granted});
        if (!granted) {
            setPermission("denied");
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
        setPermission("granted");
        const next = {
            ...settings,
            dailyNotification: true,
            notificationOptOut: false,
        };
        setSettings(next);
        await replanWith(next);
        return true;
    }, [replanWith, setPermission, setSettings, settings]);

    /** An explicit no. Remembered, so no later launch quietly undoes it. */
    const disable = useCallback(async () => {
        setSettings((current) => ({
            ...current,
            dailyNotification: false,
            notificationOptOut: true,
        }));
        await cancelAllScheduled();
    }, [setSettings]);

    const setReminderHour = useCallback(
        async (hour: number) => {
            const next = {...settings, reminderHour: hour};
            setSettings(next);
            await replanWith(next);
        },
        [replanWith, setSettings, settings]
    );

    const setLevel = useCallback(
        async (level: NotificationLevel) => {
            const next = {...settings, notificationLevel: level};
            setSettings(next);
            await replanWith(next);
        },
        [replanWith, setSettings, settings]
    );

    return {
        /**
         * Live, not merely wanted. The setting alone schedules nothing without
         * the OS grant, so anything that reports state to the user — the
         * toggle, the opt-in card — has to read both.
         */
        enabled: settings.dailyNotification && permission === "granted",
        /**
         * We have the user's blessing and not the system's. Deliberately false
         * while the status is still "unknown": on Android 12 and below the
         * permission is granted at install, and asking for something we already
         * have — even for the half second the check takes — is a card that
         * flashes up and vanishes.
         */
        needsPermission: settings.dailyNotification && permission === "denied",
        permission,
        reminderHour: settings.reminderHour,
        level: settings.notificationLevel,
        perDay: pushesPerDay(settings.notificationLevel),
        /** Days in a row the user ignored every push. Drives the back-off. */
        quietDays: notificationState.quietDays,
        enable,
        disable,
        setReminderHour,
        setLevel,
        replan,
    };
};
