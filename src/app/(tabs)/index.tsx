import {useLocalSearchParams, useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {StyleSheet, View} from "react-native";
import Animated, {useAnimatedScrollHandler} from "react-native-reanimated";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Button} from "@/components/Button/Button";
import {FloatingActionButton} from "@/components/FloatingActionButton/FloatingActionButton";
import {Icon} from "@/components/Icon/Icon";
import {NextUpCard} from "@/components/NextUpCard/NextUpCard";
import {NotificationOptIn} from "@/components/NotificationOptIn/NotificationOptIn";
import PromoModal from "@/components/PromoModal/PromoModal";
import {ShareBar} from "@/components/ShareBar/ShareBar";
import {StreakBadge} from "@/components/StreakBadge/StreakBadge";
import {Text} from "@/components/Text/Text";
import {HERO_HEIGHT, HeroSlot} from "@/components/VideoPlayer/HeroSlot";
import {usePlayerUI} from "@/components/VideoPlayer/PlayerUIProvider";
import {VideoRail} from "@/components/VideoRail/VideoRail";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {RADII, SPACE} from "@/constants/theme";
import {useEngagement} from "@/hooks/useEngagement";
import {useNextUp} from "@/hooks/useNextUp";
import {useNotifications} from "@/hooks/useNotification";
import {useOpenItem} from "@/hooks/useOpenItem";
import {useStreak} from "@/hooks/useStreak";
import type {CatalogItem} from "@/models/video";
import {track} from "@/services/analytics";
import {getDailyPick, getItemById} from "@/services/catalog";
import {detailRails, type Rail, railPool} from "@/services/recommendations";
import {
    nowPlayingAtom,
    playerEventAtom,
    setNowPlayingAtom,
} from "@/stores/player";
import {
    continueWatchingAtom,
    favoriteIdsAtom,
    historyAtom,
    recordWatchAtom,
    shortsCatalogAtom,
    videosAtom,
    watchProgressAtom,
} from "@/stores/store";
import {useTheme} from "@/theme/colors";
import {
    displayTitle,
    formatDuration,
    formatLikes,
    formatViews,
} from "@/utils/format";

/**
 * Inicio is the whole watch experience, not a teaser for a separate detail
 * screen. It used to be: a lightweight "now playing" stage here, and an
 * almost-identical full screen at `/video/[id]` for anything opened from
 * Buscar, Guardados or a notification. Splitting them duplicated the entire
 * layout for no real difference in content, and worse, gave each its own
 * player — the exact bug the singleton (`GlobalPlayerHost`) exists to kill.
 *
 * So every entry point now lands here: a rail tap swaps the player in place
 * (no navigation at all), and everything else — Buscar, Guardados, a
 * notification, an old `/video/:id` link — arrives via an `id` query param
 * that this screen consumes once and loads into the shared player. `/video/:id`
 * itself is now just a redirect into that param (see that file).
 *
 * The player is not this screen's own — it is the one global instance every
 * screen shares. This screen claims the top of the page for it via
 * `HeroSlot` while it is scrolled into view, and reads what is currently
 * loaded from `nowPlayingAtom` instead of owning that state locally.
 */
const Home = () => {
    const {id: requestedId} = useLocalSearchParams<{id?: string}>();
    const router = useRouter();

    const videos = useAtomValue(videosAtom);
    const shorts = useAtomValue(shortsCatalogAtom);
    const history = useAtomValue(historyAtom);
    const favoriteIds = useAtomValue(favoriteIdsAtom);
    const continueWatching = useAtomValue(continueWatchingAtom);
    const progressById = useAtomValue(watchProgressAtom);
    const recordWatch = useSetAtom(recordWatchAtom);
    const nowPlaying = useAtomValue(nowPlayingAtom);
    const setNowPlaying = useSetAtom(setNowPlayingAtom);
    const playerEvent = useAtomValue(playerEventAtom);

    const colors = useTheme();
    const insets = useSafeAreaInsets();
    const {streak} = useStreak();
    const engagement = useEngagement();
    const notifications = useNotifications();
    const openItem = useOpenItem();
    const {scrollY, homeScrollRef} = usePlayerUI();

    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });

    const dailyPick = useMemo(() => getDailyPick(), []);
    const [optInDismissed, setOptInDismissed] = useState(false);
    const [promoVisible, setPromoVisible] = useState(false);
    const promoShownRef = useRef(false);

    const currentVideo = nowPlaying?.item ?? null;
    /** The last id counted as a play, so a swap re-arms the tracking. */
    const startedRef = useRef<string | null>(null);

    const resumeFor = useCallback(
        (item: CatalogItem) =>
            history.find((entry) => entry.id === item.id)?.positionSeconds ?? 0,
        [history]
    );

    const recordPlayStart = useCallback(
        (item: CatalogItem, surface: string) => {
            if (startedRef.current === item.id) return;
            startedRef.current = item.id;
            engagement.recordPlay();
            track({
                name: "play_start",
                videoId: item.id,
                kind: item.kind,
                surface,
            });
            recordWatch({
                id: item.id,
                kind: item.kind,
                positionSeconds: resumeFor(item),
                durationSeconds: item.duration ?? 0,
            });
        },
        [engagement, recordWatch, resumeFor]
    );

    /*
     * Arriving from anywhere else: Buscar, Guardados, a notification, a
     * shared link. Consumed once — a stale param must not keep yanking the
     * player back to it every time this screen regains focus.
     */
    const consumedRef = useRef<string | undefined>(undefined);
    const requestedItem = useMemo(
        () => (requestedId ? getItemById(requestedId) : undefined),
        [requestedId]
    );
    useEffect(() => {
        if (!requestedId || consumedRef.current === requestedId) return;
        consumedRef.current = requestedId;
        if (!requestedItem) return;
        setNowPlaying({
            item: requestedItem,
            startAt: resumeFor(requestedItem),
            playing: true,
        });
        // Counted once the player actually confirms it, not the moment the
        // param arrives — a deep link can take a beat to boot, or fail to.
    }, [requestedId, requestedItem, resumeFor, setNowPlaying]);

    /*
     * Nothing loaded anywhere in the app yet: give the stage something to
     * show. Guarded by `everPlayedRef` rather than just `!nowPlaying`, or
     * this would refire the instant the mini player's close button clears
     * it — Home is a tab and stays mounted, so "closed" and "never started"
     * would otherwise be indistinguishable and the close button would look
     * broken, immediately replaced by the same daily pick.
     */
    const everPlayedRef = useRef(false);
    useEffect(() => {
        if (nowPlaying) everPlayedRef.current = true;
    }, [nowPlaying]);
    useEffect(() => {
        if (requestedId || nowPlaying || everPlayedRef.current) return;
        const seed = dailyPick ?? videos[0];
        if (!seed) return;
        setNowPlaying({item: seed, startAt: resumeFor(seed), playing: false});
    }, [requestedId, nowPlaying, dailyPick, videos, resumeFor, setNowPlaying]);

    const playItem = useCallback(
        (item: CatalogItem, surface = "home") => {
            setNowPlaying({item, startAt: resumeFor(item), playing: true});
            recordPlayStart(item, surface);
            if (engagement.canPromptShare && !promoShownRef.current) {
                promoShownRef.current = true;
                setPromoVisible(true);
                engagement.recordPrompt();
            }
        },
        [engagement, recordPlayStart, resumeFor, setNowPlaying]
    );

    /**
     * Episodes swap into the stage that is already mounted: no navigation, no
     * second webview, and the embed reloads in place instead of booting from
     * scratch. Shorts belong to the vertical feed, so they open it on that clip
     * and the user keeps swiping from there.
     */
    const playFromRail = useCallback(
        (item: CatalogItem, rail: Rail) => {
            if (item.kind === "short") {
                openItem(item);
                return;
            }
            playItem(item, `home:${rail.id}`);
        },
        [openItem, playItem]
    );

    const playNext = useCallback(
        (item: CatalogItem) => playItem(item, "home:autoplay"),
        [playItem]
    );

    /*
     * The stage never runs dry: when the hero finishes, the next episode is
     * already named and counting itself in — even while the player is
     * floating as a PIP over another tab, so the queue is ready the moment
     * the user looks back.
     */
    const rails = useMemo(
        (): Rail[] =>
            currentVideo
                ? detailRails({
                      videos,
                      shorts,
                      history,
                      favoriteIds,
                      current: currentVideo,
                  })
                : [],
        [currentVideo, videos, shorts, history, favoriteIds]
    );

    const handoff = useNextUp({
        rails,
        kind: currentVideo?.kind,
        excludeId: currentVideo?.id,
        onAdvance: playNext,
    });

    useEffect(() => {
        if (
            !playerEvent ||
            !currentVideo ||
            playerEvent.itemId !== currentVideo.id
        )
            return;
        if (playerEvent.event === "ready" || playerEvent.event === "playing") {
            recordPlayStart(currentVideo, "deeplink");
            handoff.clear();
        }
        if (playerEvent.event === "ended") handoff.arm();
    }, [
        playerEvent,
        currentVideo,
        recordPlayStart,
        handoff.arm,
        handoff.clear,
    ]);

    /**
     * "Seguías viendo" is modelled as a rail like every other row so it renders
     * through the same component — same paddings, same card, same analytics.
     */
    const continueRail = useMemo((): Rail | null => {
        if (continueWatching.length === 0) return null;
        return {
            id: "continue",
            title: COPY.rails.continueTitle,
            subtitle: COPY.rails.continueSubtitle,
            items: continueWatching.map(({item}) => item),
        };
    }, [continueWatching]);

    /**
     * "Sorpréndeme" used to roll a die over 535 episodes, which mostly returns
     * something the user skipped for a reason. Rolling over what the rails
     * already ranked keeps the surprise but drops the duds.
     */
    const shufflePool = useMemo(() => {
        const ranked = railPool(rails, "video");
        return ranked.length > 0 ? ranked : videos;
    }, [rails, videos]);

    const shuffle = useCallback(() => {
        if (shufflePool.length === 0) return;
        playItem(
            shufflePool[Math.floor(Math.random() * shufflePool.length)],
            "home:shuffle"
        );
    }, [playItem, shufflePool]);

    const showOptIn =
        !optInDismissed &&
        notifications.needsPermission &&
        engagement.canPromptNotifications;
    const isDaily = currentVideo?.id === dailyPick?.id;
    const resumeAt = currentVideo ? resumeFor(currentVideo) : 0;

    const meta = currentVideo
        ? [
              currentVideo.season,
              formatDuration(currentVideo.duration) ||
                  currentVideo.duration_string,
              formatViews(currentVideo.view_count),
              formatLikes(currentVideo.like_count),
          ].filter(Boolean)
        : [];

    return (
        <View style={styles.screen}>
            <Animated.ScrollView
                ref={homeScrollRef}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                contentContainerStyle={{
                    paddingBottom: insets.bottom + SPACE.huge,
                }}
            >
                <View
                    style={[styles.topBar, {paddingTop: insets.top + SPACE.xs}]}
                >
                    <View style={styles.brandBlock}>
                        <Text variant="micro" tone="faint">
                            {COPY.home.greeting.toUpperCase()}
                        </Text>
                        <Text variant="title">{COPY.appName}</Text>
                    </View>
                    <StreakBadge
                        streak={streak}
                        onPress={() => router.push(PATHS.ME)}
                    />
                </View>

                <HeroSlot
                    height={currentVideo?.kind === "short" ? 420 : HERO_HEIGHT}
                />

                {currentVideo ? (
                    <View style={styles.nowPlaying}>
                        <View style={styles.titleRow}>
                            {isDaily ? (
                                <View
                                    style={[
                                        styles.dailyPill,
                                        {backgroundColor: colors.accent},
                                    ]}
                                >
                                    <Icon
                                        name="star-four-points"
                                        size={13}
                                        color={colors.accentText}
                                    />
                                    <Text variant="micro" tone="inverse">
                                        {COPY.home.dailyBadge.toUpperCase()}
                                    </Text>
                                </View>
                            ) : resumeAt > 5 ? (
                                <View style={styles.resume}>
                                    <Icon
                                        name="play-circle-outline"
                                        size={14}
                                        color={colors.accent}
                                    />
                                    <Text variant="micro" tone="accent">
                                        {COPY.player.resume.toUpperCase()}
                                    </Text>
                                </View>
                            ) : (
                                <Text variant="micro" tone="faint">
                                    {COPY.home.nowPlaying.toUpperCase()}
                                </Text>
                            )}
                        </View>

                        <Text variant="heading" numberOfLines={2}>
                            {displayTitle(currentVideo)}
                        </Text>

                        {meta.length > 0 ? (
                            <Text variant="caption" tone="faint">
                                {meta.join(" · ")}
                            </Text>
                        ) : null}

                        {currentVideo.description ? (
                            <Text
                                variant="body"
                                tone="muted"
                                numberOfLines={4}
                                style={styles.description}
                            >
                                {currentVideo.description}
                            </Text>
                        ) : null}

                        <View
                            style={[
                                styles.actions,
                                {borderTopColor: colors.border},
                            ]}
                        >
                            <ShareBar
                                item={currentVideo}
                                source="home"
                                onShared={engagement.recordShare}
                            />
                        </View>

                        {isDaily ? (
                            <Text variant="caption" tone="muted">
                                {COPY.home.dailyHint}
                            </Text>
                        ) : null}
                    </View>
                ) : null}

                {handoff.item ? (
                    <NextUpCard
                        item={handoff.item}
                        countdown={handoff.countdown}
                        onPlay={playNext}
                        onCancel={handoff.dismiss}
                    />
                ) : null}

                {showOptIn ? (
                    <NotificationOptIn
                        onAccept={async () => {
                            const granted = await notifications.enable();
                            engagement.recordNotificationPrompt();
                            setOptInDismissed(true);
                            return granted;
                        }}
                        onDismiss={() => {
                            engagement.recordNotificationPrompt();
                            setOptInDismissed(true);
                        }}
                    />
                ) : null}

                {continueRail ? (
                    <VideoRail
                        rail={continueRail}
                        progressById={progressById}
                        onPress={playFromRail}
                        actionLabel={COPY.home.continueAction}
                        onAction={() => router.push(PATHS.ME)}
                    />
                ) : null}

                {rails.map((entry) => (
                    <VideoRail
                        key={entry.id}
                        rail={entry}
                        progressById={progressById}
                        onPress={playFromRail}
                        actionLabel={COPY.rails.seeAll}
                        onAction={
                            entry.action === "shorts"
                                ? () => router.push(PATHS.SHORTS)
                                : undefined
                        }
                    />
                ))}

                <View style={styles.catalogCta}>
                    <Button
                        title={COPY.catalog.homeCta}
                        variant="secondary"
                        icon="format-list-bulleted"
                        onPress={() => router.push(PATHS.SEARCH)}
                    />
                </View>
            </Animated.ScrollView>

            <FloatingActionButton
                onPress={shuffle}
                bottom={insets.bottom + SPACE.xxl}
            />
            <PromoModal
                visible={promoVisible}
                onClose={() => setPromoVisible(false)}
                onShared={engagement.recordShare}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.sm,
        paddingHorizontal: SPACE.md,
        paddingBottom: SPACE.sm,
    },
    brandBlock: {flex: 1, gap: 2},
    nowPlaying: {
        paddingHorizontal: SPACE.md,
        paddingTop: SPACE.sm,
        gap: SPACE.xs,
    },
    titleRow: {flexDirection: "row", alignItems: "center", gap: SPACE.xs},
    dailyPill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: SPACE.xs,
        paddingVertical: 5,
        borderRadius: RADII.pill,
    },
    resume: {flexDirection: "row", alignItems: "center", gap: SPACE.xxs},
    description: {marginTop: SPACE.xxs},
    actions: {
        marginTop: SPACE.xs,
        paddingTop: SPACE.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    catalogCta: {paddingHorizontal: SPACE.md, paddingTop: SPACE.xl},
});

export default Home;
