import {LinearGradient} from "expo-linear-gradient";
import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useMemo, useRef, useState} from "react";
import {ScrollView, StyleSheet, View} from "react-native";
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
import {VideoPlayer} from "@/components/VideoPlayer/VideoPlayer";
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
import {getDailyPick} from "@/services/catalog";
import {type Rail, railPool} from "@/services/recommendations";
import {
    continueWatchingAtom,
    homeRailsAtom,
    recordWatchAtom,
    updateProgressAtom,
    videosAtom,
    watchProgressAtom,
} from "@/stores/store";
import {useTheme} from "@/theme/colors";
import {displayTitle, formatLikes, formatViews} from "@/utils/format";

const PLAYER_HEIGHT = 220;

/**
 * Inicio is a stage, not a catalog.
 *
 * One player pinned at the top, and under it only reasons to press play. The
 * 535-episode list moved to Buscar, where browsing belongs — leaving this
 * screen short enough to hold in a plain ScrollView, which matters more than
 * it looks: a virtualised list is free to unmount its own header, and an
 * unmounted header here means the webview dies and the audio stops mid-scroll.
 */
const Home = () => {
    const videos = useAtomValue(videosAtom);
    const continueWatching = useAtomValue(continueWatchingAtom);
    const rails = useAtomValue(homeRailsAtom);
    const progressById = useAtomValue(watchProgressAtom);
    const recordWatch = useSetAtom(recordWatchAtom);
    const updateProgress = useSetAtom(updateProgressAtom);

    const colors = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const {streak} = useStreak();
    const engagement = useEngagement();
    const notifications = useNotifications();
    const openItem = useOpenItem();

    const scrollRef = useRef<ScrollView>(null);

    // The pick of the day is what plays on open: zero taps to the core action.
    const dailyPick = useMemo(() => getDailyPick(), []);
    const [currentVideo, setCurrentVideo] = useState<CatalogItem | null>(
        dailyPick ?? videos[0] ?? null
    );
    const [playing, setPlaying] = useState(false);
    const [optInDismissed, setOptInDismissed] = useState(false);
    const [promoVisible, setPromoVisible] = useState(false);
    const promoShownRef = useRef(false);

    const resumeAt = useMemo(() => {
        if (!currentVideo) return 0;
        return (
            continueWatching.find(({entry}) => entry.id === currentVideo.id)
                ?.entry.positionSeconds ?? 0
        );
    }, [continueWatching, currentVideo]);

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

    const playItem = useCallback(
        (item: CatalogItem, surface = "home") => {
            setCurrentVideo(item);
            setPlaying(true);
            /*
             * The player lives at the top of the page, so a tap on a rail four
             * screens down would otherwise start audio from something the user
             * cannot see and cannot pause. Riding the scroll back up is the
             * confirmation that the tap did what they meant.
             */
            scrollRef.current?.scrollTo({y: 0, animated: true});
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
                positionSeconds: 0,
                durationSeconds: item.duration ?? 0,
            });

            if (engagement.canPromptShare && !promoShownRef.current) {
                promoShownRef.current = true;
                setPromoVisible(true);
                engagement.recordPrompt();
            }
        },
        [engagement, recordWatch]
    );

    const handleProgress = useCallback(
        (positionSeconds: number, durationSeconds: number) => {
            if (!currentVideo) return;
            updateProgress({
                id: currentVideo.id,
                positionSeconds,
                durationSeconds,
            });
        },
        [currentVideo, updateProgress]
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
     * already named and counting itself in.
     */
    const handoff = useNextUp({
        rails,
        kind: "video",
        excludeId: currentVideo?.id,
        onAdvance: playNext,
    });

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

    /*
     * Shown when we intend to notify and the OS has not agreed yet. It is a
     * soft ask: the system dialog only appears if the user taps accept, so an
     * ignored card costs nothing and the one-shot prompt stays unspent.
     */
    const showOptIn =
        !optInDismissed &&
        notifications.needsPermission &&
        engagement.canPromptNotifications;
    const isDaily = currentVideo?.id === dailyPick?.id;

    return (
        <View style={styles.screen}>
            <ScrollView
                ref={scrollRef}
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

                <View style={styles.stage}>
                    <VideoPlayer
                        videoId={currentVideo?.id ?? null}
                        playing={playing}
                        startAt={resumeAt}
                        poster={currentVideo?.thumbnail}
                        onProgress={handleProgress}
                        height={PLAYER_HEIGHT}
                        onStateChange={(event) => {
                            if (event === "playing") {
                                setPlaying(true);
                                handoff.clear();
                            }
                            if (event === "ended") {
                                setPlaying(false);
                                handoff.arm();
                            }
                        }}
                    />
                    <LinearGradient
                        colors={["transparent", colors.background]}
                        style={styles.stageFade}
                        pointerEvents="none"
                    />
                </View>

                {currentVideo ? (
                    <View style={styles.nowPlaying}>
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
                        ) : (
                            <Text variant="micro" tone="faint">
                                {COPY.home.nowPlaying.toUpperCase()}
                            </Text>
                        )}

                        <Text variant="heading" numberOfLines={2}>
                            {displayTitle(currentVideo)}
                        </Text>

                        <View style={styles.metaRow}>
                            <Text variant="caption" tone="faint">
                                {[
                                    currentVideo.season,
                                    formatViews(currentVideo.view_count),
                                    formatLikes(currentVideo.like_count),
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </Text>
                            <ShareBar
                                item={currentVideo}
                                source="player"
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

                {/*
                 * The reasons to press play, ranked. Everything below this point
                 * is the same catalog the user could already browse — these rows
                 * are the ones that tell them why to bother.
                 */}
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

                {/* The way out to the full list, now that it lives in Buscar. */}
                <View style={styles.catalogCta}>
                    <Button
                        title={COPY.catalog.homeCta}
                        variant="secondary"
                        icon="format-list-bulleted"
                        onPress={() => router.push(PATHS.SEARCH)}
                    />
                </View>
            </ScrollView>

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
    stage: {borderRadius: RADII.none, overflow: "hidden"},
    stageFade: {position: "absolute", left: 0, right: 0, bottom: 0, height: 24},
    nowPlaying: {
        paddingHorizontal: SPACE.md,
        paddingTop: SPACE.sm,
        gap: SPACE.xs,
    },
    dailyPill: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: SPACE.xs,
        paddingVertical: 5,
        borderRadius: RADII.pill,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.sm,
        marginTop: SPACE.xxs,
    },
    catalogCta: {paddingHorizontal: SPACE.md, paddingTop: SPACE.xl},
});

export default Home;
