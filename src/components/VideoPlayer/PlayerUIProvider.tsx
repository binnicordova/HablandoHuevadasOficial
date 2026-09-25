import {createContext, type ReactNode, useContext, useRef} from "react";
import Animated, {
    type AnimatedRef,
    type SharedValue,
    useAnimatedRef,
    useSharedValue,
} from "react-native-reanimated";

export type Rect = {x: number; y: number; width: number; height: number};

type PlayerUIContextValue = {
    /** Inicio's own ScrollView offset, updated every frame on the UI thread. */
    scrollY: SharedValue<number>;
    /**
     * Where the hero slot sits in Inicio's *unscrolled* content — measured
     * once on layout, then combined with `scrollY` each frame to find its
     * current on-screen position. Zero height until Inicio has laid out once.
     */
    inlineRect: SharedValue<Rect>;
    /** So the floating player can scroll Inicio back to the top when tapped. */
    homeScrollRef: AnimatedRef<Animated.ScrollView>;
};

const PlayerUIContext = createContext<PlayerUIContextValue | null>(null);

/**
 * Wires Inicio's scroll position to the global player (see GlobalPlayerHost)
 * without either one importing the other. Mounted once at the app root,
 * above both, so the shared values survive Inicio scrolling out of focus and
 * back in.
 */
export const PlayerUIProvider = ({children}: {children: ReactNode}) => {
    const scrollY = useSharedValue(0);
    const inlineRect = useSharedValue<Rect>({x: 0, y: 0, width: 0, height: 0});
    const homeScrollRef = useAnimatedRef<Animated.ScrollView>();

    const valueRef = useRef<PlayerUIContextValue>({
        scrollY,
        inlineRect,
        homeScrollRef,
    });

    return (
        <PlayerUIContext.Provider value={valueRef.current}>
            {children}
        </PlayerUIContext.Provider>
    );
};

export const usePlayerUI = (): PlayerUIContextValue => {
    const ctx = useContext(PlayerUIContext);
    if (!ctx) {
        throw new Error("usePlayerUI must be used within PlayerUIProvider");
    }
    return ctx;
};
