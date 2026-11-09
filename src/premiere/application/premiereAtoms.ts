import {atom} from "jotai";
import {selectAtom} from "jotai/utils";
import {AppState} from "react-native";
import {getUpcomingPremiere} from "@/premiere/domain/premiere";
import {videosAtom} from "@/stores/store";
import {
    isPremiereLocked,
    samePremiereView,
    toPremiereView,
} from "./premiereView";

const TICK_MS = 1000;

/**
 * Bumped once a second while something is subscribed, and once more when the
 * app returns to the foreground (timers freeze in the background).
 */
const tickAtom = atom(0);
tickAtom.onMount = (set) => {
    const tick = () => set((n) => n + 1);
    const id = setInterval(tick, TICK_MS);
    const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") tick();
    });
    return () => {
        clearInterval(id);
        subscription.remove();
    };
};

/**
 * The wall clock, re-read on every tick. The countdown is always
 * `premiere_at - now`, never a counter that is decremented, so it cannot drift
 * and is right the instant the app wakes up. Nothing runs while no premiere
 * UI is mounted.
 */
export const nowAtom = atom((get) => {
    get(tickAtom);
    return Date.now();
});

export const upcomingPremiereAtom = atom((get) =>
    getUpcomingPremiere(get(videosAtom), get(nowAtom))
);

/**
 * The button's view of the next premiere. Equal snapshots are collapsed, so
 * subscribers re-render when the text changes (every minute, then every
 * second in the last ten) and not on every tick.
 */
export const premiereViewAtom = selectAtom(
    upcomingPremiereAtom,
    toPremiereView,
    samePremiereView
);

/**
 * The id of an announced episode that must not reach the player yet, or
 * `null`. A bare string, so it only notifies when an episode becomes locked
 * or unlocked — never on the countdown's ticks.
 */
export const premiereLockedIdAtom = selectAtom(premiereViewAtom, (view) =>
    isPremiereLocked(view) ? view.id : null
);
