import {requireOptionalNativeModule} from "expo";
import type * as ExpoObserve from "expo-observe";
import * as Updates from "expo-updates";
import {type ComponentType, useEffect, useRef} from "react";
import {Platform} from "react-native";

type InteractiveParams = ExpoObserve.ObserveInteractiveMarkerProps["params"];
type MarkInteractive = ReturnType<
    typeof ExpoObserve.useObserve
>["markInteractive"];

/**
 * EAS Observe, loaded only where its native modules exist.
 *
 * `expo-observe` resolves `ExpoAppMetrics` and `ExpoObserve` the moment it is
 * imported, and neither is in Expo Go or in any store binary built before this
 * dependency landed. A plain import kills both at launch ("Cannot find native
 * module 'ExpoAppMetrics'") — and an OTA update reaches exactly those
 * binaries. Wherever the modules are missing (Expo Go, web, older installs)
 * every export below is a no-op.
 */
const hasNativeModules =
    Platform.OS !== "web" &&
    requireOptionalNativeModule("ExpoAppMetrics") !== null &&
    requireOptionalNativeModule("ExpoObserve") !== null;

const observe: typeof ExpoObserve | null = hasNativeModules
    ? (require("expo-observe") as typeof ExpoObserve)
    : null;

const noop = () => {};

/**
 * Runs once at module scope of the root layout: the router integration throws
 * if it is switched on after `ObserveRoot` has mounted.
 */
export const configureObserve = () => {
    observe?.Observe.configure({
        // The channel the binary was built for (production / preview). Null in
        // development builds, where Observe falls back to NODE_ENV.
        environment: Updates.channel || undefined,
        integrations: {"expo-router": true},
    });
};

/** Measures time to first render around the root layout, where it can. */
export const withObserveRoot = <P extends Record<string, unknown>>(
    Component: ComponentType<P>
): ComponentType<P> =>
    observe ? observe.ObserveRoot.wrap(Component) : Component;

const useMarkInteractive: () => MarkInteractive = observe
    ? () => observe.useObserve().markInteractive
    : () => noop;

/**
 * Marks the screen interactive the first time `ready` holds. Fires once per
 * mount however often `ready` flips afterwards, so it can follow state that
 * resets (a cleared player, a re-fetch) without double-counting.
 */
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

/** Records an error the app caught and handled as a non-fatal exception. */
export const reportError = (error: unknown) => {
    observe?.Observe.reportError(error);
};
