import {Image} from "expo-image";
import {LinearGradient} from "expo-linear-gradient";
import {useIsFocused, useLocalSearchParams} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useEffect, useRef, useState} from "react";
import {
    AppState,
    FlatList,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
    type ViewToken,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Icon} from "@/components/Icon/Icon";
import {ShareBar} from "@/components/ShareBar/ShareBar";
import {Text} from "@/components/Text/Text";
import {VideoPlayer} from "@/components/VideoPlayer/VideoPlayer";
import {SPACE, TAB_BAR_HEIGHT} from "@/constants/theme";
import {useEngagement} from "@/hooks/useEngagement";
import type {CatalogItem} from "@/models/video";
import {track} from "@/services/analytics";
import {pauseHeroAtom} from "@/stores/player";
import {recordWatchAtom, settingsAtom, shortsAtom} from "@/stores/store";
import {displayTitle, formatViews} from "@/utils/format";

/**
 * Pages kept mounted on each side of the current one. One is enough: the next
 * short is already loading while the current one plays, so the swipe lands on a
 * warm player, and two webviews is what a mid-range Android can hold.
 */
const PRELOAD_RADIUS = 1;

/** A page has to be this visible before it becomes the playing one. */
const PLAY_THRESHOLD = 60;

/**
 * A view only counts once the page has held still for this long. Flicking
 * through ten shorts is one session, not ten plays, and counting it as ten
 * poisons both the history rail and the taste profile the notifications use.
 */
const COUNTED_VIEW_MS = 1200;

/**
 * What the embed is actually doing, as reported by the YouTube player.
 *
 * This deliberately does not track what the feed asked for. The two drift
 * apart on the first page of every session: YouTube refuses a scripted
 * `playVideo()` on a frame the user has never touched, so a page can sit at
 * `unstarted` while the feed believes it is playing. Every interaction below
 * keys off this value, never off the intent flag.
 */
type PlayerStatus =
    | "unstarted"
    | "video cued"
    | "buffering"
    | "playing"
    | "paused"
    | "ended";

/**
 * The vertical feed keeps its own small pool of live webviews — current plus
 * one preloaded neighbour — deliberately separate from the one global player
 * Home and the detail screen share (see `GlobalPlayerHost`).
 *
 * Folding shorts into that same singleton was tried and reverted: the first
 * tap of a session has to land on YouTube's own play button for the embed to
 * ever unlock scripted playback (see `PlayerStatus` above), which only works
 * when the webview is a real descendant of the `FlatList` doing the swiping —
 * a player hoisted outside this screen cannot sit in that position without
 * either breaking the swipe gesture or breaking that first tap. This pool is
 * the closest a swipeable feed gets to a singleton with this library.
 *
 * What the two still share is the one-thing-plays-at-a-time rule: a short
 * starting silences the hero player instead of overlapping it (`pauseHero`
 * below), the same way opening one app's audio silences another's.
 */
const Shorts = () => {
    /*
     * Opening one short from a rail lands the feed on that clip instead of
     * dropping the user at the top of it, so a tap on a thumbnail turns
     * straight into the swipe flow the feed is for.
     */
    const {id: requestedId} = useLocalSearchParams<{id?: string}>();

    const shorts = useAtomValue(shortsAtom);
    const recordWatch = useSetAtom(recordWatchAtom);
    const settings = useAtomValue(settingsAtom);
    const engagement = useEngagement();
    const pauseHero = useSetAtom(pauseHeroAtom);

    const {height, width} = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const listRef = useRef<FlatList<CatalogItem>>(null);

    /*
     * Resolved once: `initialScrollIndex` is only read on mount, and on a cold
     * open the list has no layout yet for `scrollToIndex` to work against.
     */
    const initialIndex = useRef(
        requestedId
            ? Math.max(
                  0,
                  shorts.findIndex((item) => item.id === requestedId)
              )
            : 0
    ).current;
    const consumedRef = useRef<string | undefined>(requestedId);

    const [index, setIndex] = useState(initialIndex);
    const [paused, setPaused] = useState(!settings.autoplay);
    const [status, setStatus] = useState<PlayerStatus>("unstarted");
    const [appActive, setAppActive] = useState(
        AppState.currentState === "active"
    );

    const pageHeight = height;
    const overlayBottom = insets.bottom + TAB_BAR_HEIGHT + SPACE.md;
    const currentId = shorts[index]?.id ?? null;

    /** The embed has been started at least once, so scripted calls now land. */
    const hasStarted = status !== "unstarted" && status !== "video cued";
    const isPlaying = status === "playing" || status === "buffering";

    /*
     * Later arrivals: the tab is already mounted, so the jump is a scroll. The
     * consumed guard stops a stale param from yanking the user back to it every
     * time they return to the tab.
     */
    useEffect(() => {
        if (!requestedId || consumedRef.current === requestedId) return;
        consumedRef.current = requestedId;
        const target = shorts.findIndex((item) => item.id === requestedId);
        if (target < 0) return;
        listRef.current?.scrollToIndex({index: target, animated: false});
    }, [requestedId, shorts]);

    // A short that keeps playing in the background is a battery complaint and,
    // on Android, audio over whatever the user switched to.
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) => {
            setAppActive(state === "active");
        });
        return () => subscription.remove();
    }, []);

    const countView = useCallback(
        (item: CatalogItem) => {
            engagement.recordPlay();
            track({
                name: "play_start",
                videoId: item.id,
                kind: "short",
                surface: "shorts",
            });
            recordWatch({
                id: item.id,
                kind: "short",
                positionSeconds: 0,
                durationSeconds: item.duration ?? 0,
            });
        },
        [engagement, recordWatch]
    );

    const advancedFrom = useRef<number | null>(null);

    /*
     * `viewabilityConfigCallbackPairs` is read once by FlatList, so the pairs
     * live in a ref and call through to the latest handlers instead of being
     * rebuilt on every render.
     */
    const handlers = useRef({
        onPage: (_index: number) => {},
        onCounted: (_item: CatalogItem) => {},
    });
    handlers.current.onPage = (next: number) => {
        setIndex(next);
        // Landing on a new short resumes playback — a pause belongs to the clip
        // that was paused, not to the feed. With autoplay off it lands paused
        // instead, waiting for a tap.
        setPaused(!settings.autoplay);
        // A fresh page is a fresh embed, back to square one on the gesture it
        // still owes YouTube.
        setStatus("unstarted");
        advancedFrom.current = null;
    };
    handlers.current.onCounted = countView;

    const viewabilityConfigCallbackPairs = useRef([
        {
            // Which page is playing. Deliberately eager: playback should start
            // while the swipe is still settling.
            viewabilityConfig: {itemVisiblePercentThreshold: PLAY_THRESHOLD},
            onViewableItemsChanged: ({
                viewableItems,
            }: {
                viewableItems: ViewToken[];
            }) => {
                const first = viewableItems[0];
                if (!first || first.index === null) return;
                handlers.current.onPage(first.index);
            },
        },
        {
            // Which page counts as watched. Deliberately patient.
            viewabilityConfig: {
                itemVisiblePercentThreshold: 80,
                minimumViewTime: COUNTED_VIEW_MS,
            },
            onViewableItemsChanged: ({
                viewableItems,
            }: {
                viewableItems: ViewToken[];
            }) => {
                const item = viewableItems[0]?.item as CatalogItem | undefined;
                if (item) handlers.current.onCounted(item);
            },
        },
    ]);

    /**
     * Autoplay the next short when the current one ends.
     *
     * This is the whole point of a vertical feed: the user never has to decide
     * to keep watching. The guard stops the YouTube player's repeated "ended"
     * events from skipping two pages at once.
     */
    const handleEnded = useCallback(() => {
        if (!settings.autoplay) return;
        if (advancedFrom.current === index) return;
        const next = index + 1;
        if (next >= shorts.length) return;
        advancedFrom.current = index;
        listRef.current?.scrollToIndex({index: next, animated: true});
    }, [index, settings.autoplay, shorts.length]);

    /**
     * Mirror whatever the embed decides into the feed's own state.
     *
     * Playback can start without the feed asking for it — the first tap of a
     * session goes straight to YouTube's play button — and it can refuse to
     * start when the feed does ask. Folding the reported state back into
     * `paused` keeps the next tap on the overlay meaningful either way.
     */
    const handleStateChange = useCallback(
        (event: string) => {
            const next = event as PlayerStatus;
            setStatus(next);
            if (next === "playing") {
                setPaused(false);
                // The app plays at most one thing at a time. A short taking
                // over silences whatever the hero player was doing elsewhere,
                // the way opening a different app pauses the last one.
                pauseHero();
            } else if (next === "paused") setPaused(true);
            else if (next === "ended") handleEnded();
        },
        [handleEnded, pauseHero]
    );

    const renderItem = useCallback(
        ({item, index: itemIndex}: {item: CatalogItem; index: number}) => {
            const isCurrent = itemIndex === index;
            const wantsPlay = isCurrent && isFocused && appActive && !paused;
            const live = isCurrent && isPlaying;

            return (
                <View style={[styles.page, {height: pageHeight, width}]}>
                    {Math.abs(itemIndex - index) <= PRELOAD_RADIUS ? (
                        <VideoPlayer
                            videoId={item.id}
                            playing={wantsPlay}
                            height={pageHeight}
                            poster={item.thumbnail}
                            onStateChange={
                                isCurrent ? handleStateChange : undefined
                            }
                            fill
                        />
                    ) : (
                        // Out of reach: a live webview here is memory nobody
                        // is looking at, so the page keeps just its cover.
                        <Image
                            source={item.thumbnail}
                            style={[styles.cover, {height: pageHeight}]}
                            contentFit="cover"
                            cachePolicy="disk"
                            recyclingKey={item.id}
                        />
                    )}

                    {/* Tap anywhere to pause, the way every vertical feed
                        behaves. Sits under the overlay so share and favourite
                        still get their taps.

                        It stays transparent to touch until the embed has
                        actually started, because YouTube will not honour a
                        scripted play on a frame it has never seen a tap on:
                        the first tap has to reach the player's own button, and
                        covering that button with a pause target is what left
                        the feed unplayable. Once playback is under way the
                        scripted calls are allowed and this becomes the
                        tap-to-pause surface. */}
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        pointerEvents={
                            isCurrent && hasStarted ? "auto" : "none"
                        }
                        accessibilityRole="button"
                        accessibilityLabel={
                            live ? "Pausar el short" : "Reproducir el short"
                        }
                        onPress={() => setPaused((current) => !current)}
                    />

                    {isCurrent && isFocused && hasStarted && !live ? (
                        <View style={styles.pausedBadge} pointerEvents="none">
                            <Icon name="play" size={34} color="#FFFFFF" />
                        </View>
                    ) : null}

                    <LinearGradient
                        colors={["rgba(5,5,7,0.8)", "transparent"]}
                        style={[styles.topScrim, {height: insets.top + 48}]}
                        pointerEvents="none"
                    />
                    <LinearGradient
                        colors={["transparent", "rgba(5,5,7,0.9)"]}
                        style={styles.bottomScrim}
                        pointerEvents="none"
                    />

                    <View
                        style={[styles.overlay, {bottom: overlayBottom}]}
                        pointerEvents="box-none"
                    >
                        <View style={styles.meta}>
                            <Text variant="subheading" numberOfLines={2}>
                                {displayTitle(item)}
                            </Text>
                            <Text variant="caption" tone="muted">
                                {formatViews(item.view_count)}
                            </Text>
                        </View>
                        <ShareBar
                            item={item}
                            source="shorts"
                            layout="column"
                            tint="#FFFFFF"
                            onShared={engagement.recordShare}
                        />
                    </View>
                </View>
            );
        },
        [
            appActive,
            engagement.recordShare,
            handleStateChange,
            hasStarted,
            index,
            insets.top,
            isFocused,
            isPlaying,
            overlayBottom,
            pageHeight,
            paused,
            width,
        ]
    );

    return (
        <View style={styles.screen}>
            <FlatList
                ref={listRef}
                data={shorts}
                keyExtractor={(item) => item.id}
                extraData={`${currentId}-${status}-${paused}-${appActive}`}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                windowSize={3}
                initialScrollIndex={initialIndex}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                removeClippedSubviews
                getItemLayout={(_data, itemIndex) => ({
                    length: pageHeight,
                    offset: pageHeight * itemIndex,
                    index: itemIndex,
                })}
                viewabilityConfigCallbackPairs={
                    viewabilityConfigCallbackPairs.current
                }
                renderItem={renderItem}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1, backgroundColor: "#050507"},
    page: {
        backgroundColor: "#050507",
        justifyContent: "center",
        overflow: "hidden",
    },
    cover: {width: "100%"},
    topScrim: {position: "absolute", top: 0, left: 0, right: 0},
    bottomScrim: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 220,
    },
    pausedBadge: {
        position: "absolute",
        alignSelf: "center",
        top: "45%",
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(5,5,7,0.55)",
    },
    overlay: {
        position: "absolute",
        left: 0,
        right: 0,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: SPACE.sm,
        paddingHorizontal: SPACE.md,
    },
    meta: {flex: 1, gap: SPACE.xxs},
});

export default Shorts;
