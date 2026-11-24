import {requireOptionalNativeModule} from "expo";
import type * as ExpoObserve from "expo-observe";
import * as Updates from "expo-updates";
import {type ComponentType, useEffect, useRef} from "react";
import {Platform} from "react-native";
import {isExpoGo} from "@/utils/notification";

type InteractiveParams = ExpoObserve.ObserveInteractiveMarkerProps["params"];
type MarkInteractive = ReturnType<
    typeof ExpoObserve.useObserve
>["markInteractive"];

const hasNativeModules = () =>
    requireOptionalNativeModule("ExpoAppMetrics") !== null &&
    requireOptionalNativeModule("ExpoObserve") !== null;

export const OBSERVE_SUPPORTED =
    Platform.OS !== "web" && !isExpoGo && hasNativeModules();

const observe: typeof ExpoObserve | null = OBSERVE_SUPPORTED
    ? (require("expo-observe") as typeof ExpoObserve)
    : null;

const noop = () => {};

export const configureObserve = () => {
    if (!observe) {
        if (isExpoGo) {
            console.log(
                "[Observe] Disabled in Expo Go — use a development build to collect metrics."
            );
        }
        return;
    }

    observe.Observe.configure({
        environment: Updates.channel || undefined,
        integrations: {"expo-router": true},
    });
};

export const withObserveRoot = <P extends Record<string, unknown>>(
    Component: ComponentType<P>
): ComponentType<P> =>
    observe ? observe.ObserveRoot.wrap(Component) : Component;

const useMarkInteractive: () => MarkInteractive = observe
    ? () => observe.useObserve().markInteractive
    : () => noop;

export const useInteractiveWhen = (
    ready: boolean,
    params?: InteractiveParams
) => {
    const markInteractive = useMarkInteractive();
    const marked = useRef(false);

    useEffect(() => {
        if (!ready || marked.current) return;
        marked.current = true;
        markInteractive({params});
    }, [ready, params, markInteractive]);
};

export const reportError = (error: unknown) => {
    observe?.Observe.reportError(error);
};
