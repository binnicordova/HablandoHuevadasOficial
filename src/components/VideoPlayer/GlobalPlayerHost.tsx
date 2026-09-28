import {LinearGradient} from "expo-linear-gradient";
import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useEffect, useMemo, useState} from "react";
import {useWindowDimensions, View} from "react-native";
import {Gesture, GestureDetector} from "react-native-gesture-handler";
import Animated, {
    clamp,
    Easing,
    runOnJS,
    scrollTo,
    useAnimatedReaction,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Icon} from "@/components/Icon/Icon";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {SPACE, TAB_BAR_HEIGHT} from "@/constants/theme";
import {getHeroTint} from "@/services/catalog";
import {
    clearNowPlayingAtom,
    emitPlayerEventAtom,
    heroFocusedAtom,
    nowPlayingAtom,
    setHeroPlayingAtom,
} from "@/stores/player";
import {updateProgressAtom} from "@/stores/store";
import {useTheme} from "@/theme/colors";
import {displayTitle} from "@/utils/format";
import {selectionFeedback, tapFeedback} from "@/utils/haptics";
import {styles} from "./GlobalPlayerHost.styles";
import {HERO_HEIGHT} from "./HeroSlot";
import {usePlayerUI} from "./PlayerUIProvider";
import {VideoPlayer} from "./VideoPlayer";

const PIP_ASPECT = 16 / 9;
const PIP_DEFAULT_WIDTH = 160;
const PIP_MIN_WIDTH = 110;
const PIP_MAX_WIDTH = 300;
const POP_MS = 220;
/** How much of the box stays on screen once it is tucked against an edge. */
const PEEK_VISIBLE = 28;
/** How far past the edge a drag has to go, as a fraction of the box's own
 *  width, before letting go tucks it away instead of snapping to a corner. */
const PEEK_TRIGGER_RATIO = 0.5;
/** Corner hit-target for the close button, generous enough for a thumb —
 *  bigger than the 26px icon actually drawn there. */
const CORNER_HIT = 44;
/** Width of the status ring traced just past the pip box's own edge — a
 *  hairline, not a halo. */
const RING_WIDTH = 1.5;
/** One full breathe, in and out — slow and quiet, not a flashing alert. */
const RING_PULSE_MS = 2600;

/**
 * The one `<VideoPlayer>` (and therefore the one YouTube WebView) the whole
 * app ever mounts for an episode. Rendered once at the root, above every
 * screen, so pushing or popping a route — or switching tabs — never tears it
 * down and boots a second one.
 *
 * It has three positions, all the same element, never conditionally
 * unmounted between them:
 *  - inline: sitting in Inicio's own scrolling content, exactly where
 *    `HeroSlot` reserved space for it, tracking the scroll offset 1:1 on the
 *    UI thread.
 *  - pip: a small floating window once it has scrolled out of Inicio's
 *    viewport, or once Inicio isn't the screen on top at all — draggable,
 *    pinch-to-resize, snaps to the nearest corner on release, and tucks
 *    itself against the left/right edge (a thin peek + reveal arrow) when
 *    dragged past it, the way a chat head or a real PIP window would.
 *  - hidden: nothing is loaded.
 *
 * Rendering two separate `<VideoPlayer>` elements for these would tear the
 * webview down and rebuild it exactly like the bug this replaces — so
 * position is the only thing that changes, driven by shared values instead
 * of by conditional JSX.
 */
export const GlobalPlayerHost = () => {
    const nowPlaying = useAtomValue(nowPlayingAtom);
    const isHomeFocused = useAtomValue(heroFocusedAtom);
    const setPlaying = useSetAtom(setHeroPlayingAtom);
    const clear = useSetAtom(clearNowPlayingAtom);
    const emitEvent = useSetAtom(emitPlayerEventAtom);
    const updateProgress = useSetAtom(updateProgressAtom);
    const router = useRouter();
    const colors = useTheme();
    const insets = useSafeAreaInsets();
    const {width: windowWidth, height: windowHeight} = useWindowDimensions();
    const {scrollY, inlineRect, homeScrollRef} = usePlayerUI();

    const bounds = {
        left: insets.left + SPACE.xs,
        right: windowWidth - insets.right - SPACE.xs,
        top: insets.top + SPACE.xs,
        bottom: windowHeight - insets.bottom - TAB_BAR_HEIGHT - SPACE.xs,
    };
    const maxPipWidth = Math.min(PIP_MAX_WIDTH, bounds.right - bounds.left);

    const isHomeFocusedShared = useSharedValue(isHomeFocused);
    useEffect(() => {
        isHomeFocusedShared.value = isHomeFocused;
    }, [isHomeFocused, isHomeFocusedShared]);

    const pipX = useSharedValue(bounds.right - PIP_DEFAULT_WIDTH);
    const pipY = useSharedValue(bounds.bottom - PIP_DEFAULT_WIDTH / PIP_ASPECT);
    const pipWidth = useSharedValue(PIP_DEFAULT_WIDTH);
    const pipHeight = useSharedValue(PIP_DEFAULT_WIDTH / PIP_ASPECT);
    const dragOrigin = useSharedValue({x: 0, y: 0});
    const pinchOrigin = useSharedValue({x: 0, y: 0, width: 0, height: 0});
    /** Set once the box has ever been placed, so re-entering pip mode later
     *  in the session remembers where the user left it instead of always
     *  popping back to the default corner. */
    const hasPositioned = useSharedValue(false);
    const isPeeking = useSharedValue(false);

    const [uiMode, setUiMode] = useState<"inline" | "pip">("inline");
    const [playerHeight, setPlayerHeight] = useState(HERO_HEIGHT);
    const [peekSide, setPeekSide] = useState<"left" | "right" | null>(null);

    const goHome = useCallback(() => router.navigate(PATHS.HOME), [router]);
    const syncPlayerHeight = useCallback(
        (height: number) => setPlayerHeight(height),
        []
    );
    const closePip = useCallback(() => {
        tapFeedback();
        clear();
    }, [clear]);
    const reveal = useCallback(() => {
        selectionFeedback();
        setPeekSide(null);
    }, []);
    const snap = useCallback(() => {
        selectionFeedback();
    }, []);

    const mode = useDerivedValue(() => {
        // Before Inicio's first layout, `inlineRect` is still zeroed — treat
        // that as "assume inline" rather than flashing a pip in the corner
        // for one frame while nothing has been measured yet.
        const pastThreshold =
            inlineRect.value.height > 0 &&
            scrollY.value > inlineRect.value.height * 0.85;
        return isHomeFocusedShared.value && !pastThreshold ? "inline" : "pip";
    });

    /** Nearest of the 4 corners to the box's current centre. */
    const nearestCorner = () => {
        "worklet";
        const cx = pipX.value + pipWidth.value / 2;
        const cy = pipY.value + pipHeight.value / 2;
        const midX = (bounds.left + bounds.right) / 2;
        const midY = (bounds.top + bounds.bottom) / 2;
        return {
            x: cx < midX ? bounds.left : bounds.right - pipWidth.value,
            y: cy < midY ? bounds.top : bounds.bottom - pipHeight.value,
        };
    };

    useAnimatedReaction(
        () => mode.value,
        (current, previous) => {
            if (current === previous) return;
            runOnJS(setUiMode)(current);
            if (current === "pip") {
                if (!hasPositioned.value) {
                    hasPositioned.value = true;
                    pipX.value = withTiming(bounds.right - PIP_DEFAULT_WIDTH, {
                        duration: POP_MS,
                    });
                    pipY.value = withTiming(
                        bounds.bottom - PIP_DEFAULT_WIDTH / PIP_ASPECT,
                        {duration: POP_MS}
                    );
                }
                runOnJS(syncPlayerHeight)(pipHeight.value);
            } else {
                runOnJS(syncPlayerHeight)(HERO_HEIGHT);
            }
        }
    );

    const containerStyle = useAnimatedStyle(() => {
        if (mode.value === "inline") {
            return {
                left: inlineRect.value.x,
                top: inlineRect.value.y - scrollY.value,
                width: inlineRect.value.width,
                height: inlineRect.value.height,
                borderRadius: 0,
            };
        }
        return {
            left: pipX.value,
            top: pipY.value,
            width: pipWidth.value,
            height: pipHeight.value,
            borderRadius: 14,
        };
    });

    /**
     * One tap gesture for the whole pip box, deciding what it hit by
     * coordinate instead of by nested `GestureDetector`s. Two overlapping
     * detectors (the box's own drag/tap, and a button's tap living inside
     * it) turned out not to reliably cede priority to the small one no
     * matter how `requireExternalGestureToFail` was wired — the box's own
     * gesture kept winning. Checking `e.x`/`e.y` against the corners here
     * sidesteps that fight entirely: there is only one gesture to arbitrate.
     */
    const tapGesture = Gesture.Tap()
        .maxDuration(250)
        .onEnd((e, success) => {
            "worklet";
            if (!success || mode.value !== "pip") return;
            if (isPeeking.value) {
                isPeeking.value = false;
                const target = nearestCorner();
                pipX.value = withSpring(target.x);
                pipY.value = withSpring(target.y);
                runOnJS(reveal)();
                return;
            }
            if (e.y < CORNER_HIT && e.x > pipWidth.value - CORNER_HIT) {
                runOnJS(closePip)();
                return;
            }
            if (isHomeFocusedShared.value) {
                scrollTo(homeScrollRef, 0, 0, true);
            } else {
                runOnJS(goHome)();
            }
        });

    const dragGesture = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .minDistance(6)
        .onStart(() => {
            "worklet";
            dragOrigin.value = {x: pipX.value, y: pipY.value};
        })
        .onUpdate((e) => {
            "worklet";
            if (mode.value !== "pip") return;
            // Horizontally, deliberately allowed to overshoot the normal
            // bounds — that overdrag toward an edge is what "let go to tuck
            // it away" feels like while it is happening.
            pipX.value = clamp(
                dragOrigin.value.x + e.translationX,
                -pipWidth.value * 0.7,
                windowWidth - pipWidth.value * 0.3
            );
            pipY.value = clamp(
                dragOrigin.value.y + e.translationY,
                bounds.top,
                bounds.bottom - pipHeight.value
            );
        })
        .onEnd(() => {
            "worklet";
            // Tucks away once more than half the box has crossed the edge —
            // i.e. its own centre has gone past x=0 or past the screen's
            // right edge — rather than snapping to a corner.
            const tippedLeft =
                pipX.value + pipWidth.value * PEEK_TRIGGER_RATIO < 0;
            const tippedRight =
                pipX.value + pipWidth.value * (1 - PEEK_TRIGGER_RATIO) >
                windowWidth;
            if (tippedLeft || tippedRight) {
                const side = tippedLeft ? "left" : "right";
                isPeeking.value = true;
                pipX.value = withSpring(
                    side === "left"
                        ? PEEK_VISIBLE - pipWidth.value
                        : windowWidth - PEEK_VISIBLE
                );
                pipY.value = withSpring(
                    clamp(
                        pipY.value,
                        bounds.top,
                        bounds.bottom - pipHeight.value
                    )
                );
                runOnJS(setPeekSide)(side);
                runOnJS(selectionFeedback)();
            } else {
                isPeeking.value = false;
                const target = nearestCorner();
                pipX.value = withSpring(target.x);
                pipY.value = withSpring(target.y);
                runOnJS(setPeekSide)(null);
                runOnJS(snap)();
            }
        });

    const pinchGesture = Gesture.Pinch()
        .onStart(() => {
            "worklet";
            if (mode.value !== "pip" || isPeeking.value) return;
            pinchOrigin.value = {
                x: pipX.value,
                y: pipY.value,
                width: pipWidth.value,
                height: pipHeight.value,
            };
        })
        .onUpdate((e) => {
            "worklet";
            if (mode.value !== "pip" || isPeeking.value) return;
            const newWidth = clamp(
                pinchOrigin.value.width * e.scale,
                PIP_MIN_WIDTH,
                maxPipWidth
            );
            const newHeight = newWidth / PIP_ASPECT;
            // Resizes around the box's own centre rather than a fixed
            // corner — the natural anchor for a two-finger pinch.
            const cx = pinchOrigin.value.x + pinchOrigin.value.width / 2;
            const cy = pinchOrigin.value.y + pinchOrigin.value.height / 2;
            pipWidth.value = newWidth;
            pipHeight.value = newHeight;
            pipX.value = cx - newWidth / 2;
            pipY.value = cy - newHeight / 2;
        })
        .onEnd(() => {
            "worklet";
            if (mode.value !== "pip" || isPeeking.value) return;
            pipX.value = withSpring(
                clamp(pipX.value, bounds.left, bounds.right - pipWidth.value)
            );
            pipY.value = withSpring(
                clamp(pipY.value, bounds.top, bounds.bottom - pipHeight.value)
            );
            runOnJS(syncPlayerHeight)(pipHeight.value);
        });

    /*
     * A pure race, pinch included: a second finger joining mid-drag lets
     * pinch win outright and cancel the in-progress pan, rather than trying
     * to run pan and pinch "simultaneously" — nobody drags with one finger
     * while pinching with a second, and letting them compete for the same
     * touches was what let a two-finger touch get mistaken for a plain tap.
     */
    const boxGesture = Gesture.Race(pinchGesture, tapGesture, dragGesture);

    const itemId = nowPlaying?.item.id;
    const handleProgress = useCallback(
        (positionSeconds: number, durationSeconds: number) => {
            if (!itemId) return;
            updateProgress({id: itemId, positionSeconds, durationSeconds});
        },
        [itemId, updateProgress]
    );

    /**
     * A real live/upcoming premiere only — an on-screen badge is warranted
     * because something is genuinely happening right now. Passed straight
     * into `VideoPlayer`, which draws it over the frame.
     */
    const liveStatus = useMemo((): "upcoming" | "live" | undefined => {
        const status = nowPlaying?.item.live_status;
        return status === "live" || status === "upcoming" ? status : undefined;
    }, [nowPlaying?.item]);

    /** See `services/catalog.ts#getHeroTint` — the one shared source for
     *  what colour story (if any) this item's status gets everywhere. */
    const heroTint = useMemo(
        () => getHeroTint(nowPlaying?.item ?? null),
        [nowPlaying?.item]
    );

    const glowActive = useSharedValue(false);
    useEffect(() => {
        glowActive.value = heroTint !== null;
    }, [heroTint, glowActive]);

    const glowColors: readonly [string, string] =
        heroTint === "premiere"
            ? [colors.hot, colors.hotDim]
            : [colors.warning, colors.accent];

    /**
     * The status tint is a second gradient layered over the ordinary stage
     * fade, not an extra colour stop baked into it. A flat "transparent →
     * tint → background" stop reads as a sticker — the tint has nowhere
     * left to fade, so it lands as a hard-edged band. A pure alpha ramp of
     * the same hue, stacked on top, has nowhere it *isn't* fading, and the
     * `locations` delay keeps it out of the frame's upper half entirely —
     * it only ever gathers where the base fade is already going dark.
     */
    const stageTintColors: readonly [string, string, string] | null =
        heroTint === "premiere"
            ? [
                  colors.premiereGlowFrom,
                  colors.premiereGlowFrom,
                  colors.premiereGlow,
              ]
            : heroTint === "new"
              ? [colors.freshGlowFrom, colors.freshGlowFrom, colors.freshGlow]
              : null;
    const stageTintLocations = [0, 0.5, 1] as const;

    const glowPulse = useSharedValue(0);
    useEffect(() => {
        glowPulse.value = withRepeat(
            withTiming(1, {
                duration: RING_PULSE_MS,
                easing: Easing.inOut(Easing.sin),
            }),
            -1,
            true
        );
    }, [glowPulse]);

    /**
     * The status ring: a hairline gradient traced just past the pip box's
     * own edge — the box's opaque video sits in front and covers everything
     * but that sliver. Only pip has room for it; inline is edge to edge by
     * design, so it simply reads as inactive there rather than crowding the
     * video to compensate. No scale, no bloom — a thin line and a slow
     * breathe in opacity is the whole effect.
     */
    const glowRectStyle = useAnimatedStyle(() => ({
        left: pipX.value - RING_WIDTH,
        top: pipY.value - RING_WIDTH,
        width: pipWidth.value + RING_WIDTH * 2,
        height: pipHeight.value + RING_WIDTH * 2,
        borderRadius: 14 + RING_WIDTH,
    }));
    const glowFadeStyle = useAnimatedStyle(() => {
        const visible = glowActive.value && mode.value === "pip";
        return {opacity: visible ? 0.55 + glowPulse.value * 0.2 : 0};
    });

    if (!nowPlaying) return null;

    const handleStateChange = (event: string) => {
        emitEvent({event, itemId: nowPlaying.item.id});
        if (event === "playing") setPlaying(true);
        if (event === "ended") setPlaying(false);
    };

    return (
        <Animated.View style={styles.overlay} pointerEvents="box-none">
            {/*
             * "Hot" halo — a real premiere, or a video still inside its
             * freshly-published window. Painted first (so behind everything
             * else), inflated past the box on every side: the box's own
             * opaque video sits on top and covers the middle, so only that
             * outer margin ever reads as a glow. Never a badge, never on top
             * of the frame.
             */}
            <Animated.View
                pointerEvents="none"
                style={[styles.glow, glowRectStyle, glowFadeStyle]}
            >
                <LinearGradient
                    colors={glowColors}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.flexFull}
                />
            </Animated.View>

            {/*
             * The video itself carries no gesture handling — inline, the
             * user has to be able to reach YouTube's own control bar
             * (play/seek/fullscreen) exactly like before this player was a
             * singleton. `pointerEvents="none"` while in pip mode hands all
             * of it to the overlay below, which is what actually needs to
             * own the touch.
             */}
            <Animated.View
                pointerEvents={uiMode === "pip" ? "none" : "auto"}
                style={[
                    styles.box,
                    containerStyle,
                    uiMode === "pip" && styles.pipShadow,
                ]}
            >
                <VideoPlayer
                    videoId={nowPlaying.item.id}
                    playing={nowPlaying.playing}
                    startAt={nowPlaying.startAt}
                    poster={nowPlaying.item.thumbnail}
                    height={playerHeight}
                    onStateChange={handleStateChange}
                    onProgress={handleProgress}
                    liveStatus={liveStatus}
                />
                {uiMode === "inline" ? (
                    <>
                        <LinearGradient
                            colors={["transparent", colors.background]}
                            style={styles.stageFade}
                            pointerEvents="none"
                        />
                        {stageTintColors ? (
                            <LinearGradient
                                colors={stageTintColors}
                                locations={stageTintLocations}
                                style={styles.stageFade}
                                pointerEvents="none"
                            />
                        ) : null}
                    </>
                ) : null}
            </Animated.View>

            {uiMode === "pip" ? (
                /*
                 * A fully opaque-to-touch sibling, painted after (so on top
                 * of) the video above, in the exact same rect. Attaching the
                 * gesture here instead of wrapping the video directly is
                 * what actually keeps a tap from reaching the embedded
                 * WebView's own "watch on YouTube" link underneath — wrapping
                 * it as a parent let the native webview win that race often
                 * enough to be a real bug, the same reason Shorts' tap-to-
                 * pause layer is a sibling over its webview rather than a
                 * parent around it.
                 */
                <GestureDetector gesture={boxGesture}>
                    <Animated.View
                        accessible
                        accessibilityLabel={displayTitle(nowPlaying.item)}
                        accessibilityHint={
                            peekSide
                                ? COPY.player.pipRevealHint
                                : COPY.player.pipHint
                        }
                        style={[styles.box, containerStyle]}
                    >
                        {peekSide ? (
                            <View
                                importantForAccessibility="no-hide-descendants"
                                style={[
                                    styles.peekArrow,
                                    peekSide === "right"
                                        ? styles.peekArrowLeftEdge
                                        : styles.peekArrowRightEdge,
                                ]}
                            >
                                <Icon
                                    name={
                                        peekSide === "right"
                                            ? "chevron-left"
                                            : "chevron-right"
                                    }
                                    size={20}
                                    color="#FFFFFF"
                                />
                            </View>
                        ) : (
                            /*
                             * Decorative only. The close corner's tap is
                             * handled by `tapGesture` above, keyed off where
                             * inside the box it landed, not by this view
                             * itself. The status corner has no tap of its
                             * own at all — it is a read-only echo of
                             * `heroTint`, the same signal already colouring
                             * the ring and the stage fade, not a control
                             * (the old play/pause button here never
                             * reliably reflected the real state and is gone
                             * for it). A screen reader user gets the
                             * whole-box label instead of either corner.
                             */
                            <>
                                {heroTint ? (
                                    <View
                                        importantForAccessibility="no-hide-descendants"
                                        style={[
                                            styles.pipButton,
                                            styles.statusBadge,
                                        ]}
                                    >
                                        <Icon
                                            name="fire"
                                            size={14}
                                            color={
                                                heroTint === "premiere"
                                                    ? colors.hot
                                                    : colors.warning
                                            }
                                        />
                                    </View>
                                ) : null}
                                <View
                                    importantForAccessibility="no-hide-descendants"
                                    style={[
                                        styles.pipButton,
                                        styles.closeButton,
                                    ]}
                                >
                                    <Icon
                                        name="close"
                                        size={15}
                                        color="#FFFFFF"
                                    />
                                </View>
                            </>
                        )}
                    </Animated.View>
                </GestureDetector>
            ) : null}
        </Animated.View>
    );
};
