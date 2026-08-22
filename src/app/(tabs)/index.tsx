import {FlashList} from "@shopify/flash-list";
import {LinearGradient} from "expo-linear-gradient";
import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useMemo, useRef, useState} from "react";
import {ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {FloatingActionButton} from "@/components/FloatingActionButton/FloatingActionButton";
import {Icon} from "@/components/Icon/Icon";
import {NotificationOptIn} from "@/components/NotificationOptIn/NotificationOptIn";
import PromoModal from "@/components/PromoModal/PromoModal";
import {SectionHeader} from "@/components/SectionHeader/SectionHeader";
import {ShareBar} from "@/components/ShareBar/ShareBar";
import {StreakBadge} from "@/components/StreakBadge/StreakBadge";
import {Text} from "@/components/Text/Text";
import {VideoCard} from "@/components/VideoCard/VideoCard";
import {VideoItem} from "@/components/VideoItem/VideoItem";
import {VideoPlayer} from "@/components/VideoPlayer/VideoPlayer";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {RADII, SPACE} from "@/constants/theme";
import {useEngagement} from "@/hooks/useEngagement";
import {useNotifications} from "@/hooks/useNotification";
import {useStreak} from "@/hooks/useStreak";
import type {CatalogItem} from "@/models/video";
import {track} from "@/services/analytics";
import {getDailyPick} from "@/services/catalog";
import {
    continueWatchingAtom,
    recordWatchAtom,
    updateProgressAtom,
    videosAtom,
} from "@/stores/store";
import {useTheme} from "@/theme/colors";
import {formatViews} from "@/utils/format";

const PLAYER_HEIGHT = 220;

const Home = () => {
    const videos = useAtomValue(videosAtom);
    const continueWatching = useAtomValue(continueWatchingAtom);
    const recordWatch = useSetAtom(recordWatchAtom);
    const updateProgress = useSetAtom(updateProgressAtom);

    const colors = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const {streak} = useStreak();
    const engagement = useEngagement();
    const notifications = useNotifications();

    // The pick of the day is what plays on open: zero taps to the core action.
    const dailyPick = useMemo(() => getDailyPick(), []);
    const [currentVideo, setCurrentVideo] = useState<CatalogItem | null>(
        dailyPick ?? videos[0] ?? null
    );
    const [playing, setPlaying] = useState(false);
    const [optInDismissed, setOptInDismissed] = useState(false);
    const [promoVisible, setPromoVisible] = useState(false);
    const promoShownRef = useRef(false);

    const progressById = useMemo(() => {
        const map = new Map<string, number>();
        for (const {entry} of continueWatching) {
            if (entry.durationSeconds > 0) {
                map.set(
                    entry.id,
                    entry.positionSeconds / entry.durationSeconds
                );
            }
        }
        return map;
    }, [continueWatching]);

    const resumeAt = useMemo(() => {
        if (!currentVideo) return 0;
        return (
            continueWatching.find(({entry}) => entry.id === currentVideo.id)
                ?.entry.positionSeconds ?? 0
        );
    }, [continueWatching, currentVideo]);

    const playItem = useCallback(
        (item: CatalogItem) => {
            setCurrentVideo(item);
            setPlaying(true);
            engagement.recordPlay();
            track({
                name: "play_start",
                videoId: item.id,
                kind: item.kind,
                surface: "home",
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

    const shuffle = useCallback(() => {
        if (videos.length === 0) return;
        playItem(videos[Math.floor(Math.random() * videos.length)]);
    }, [playItem, videos]);

    const showOptIn =
        !optInDismissed &&
        engagement.canPromptNotifications &&
        !notifications.enabled;
    const isDaily = currentVideo?.id === dailyPick?.id;

    const header = (
        <View>
            <View style={[styles.topBar, {paddingTop: insets.top + SPACE.xs}]}>
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
                        if (event === "ended") setPlaying(false);
                        if (event === "playing") setPlaying(true);
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
                        {currentVideo.title}
                    </Text>

                    <View style={styles.metaRow}>
                        <Text variant="caption" tone="faint">
                            {formatViews(currentVideo.view_count)}
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

            {showOptIn ? (
                <NotificationOptIn
                    onAccept={async () => {
                        const granted = await notifications.enable();
                        engagement.markNotificationPromptSeen();
                        setOptInDismissed(true);
                        return granted;
                    }}
                    onDismiss={() => {
                        engagement.markNotificationPromptSeen();
                        setOptInDismissed(true);
                    }}
                />
            ) : null}

            {continueWatching.length > 0 ? (
                <>
                    <SectionHeader
                        title={COPY.home.continueTitle}
                        subtitle={COPY.home.continueSubtitle}
                        actionLabel={COPY.home.continueAction}
                        onAction={() => router.push(PATHS.ME)}
                    />
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.rail}
                    >
                        {continueWatching.map(({item, entry}) => (
                            <VideoCard
                                key={item.id}
                                item={item}
                                progress={
                                    entry.durationSeconds > 0
                                        ? entry.positionSeconds /
                                          entry.durationSeconds
                                        : 0
                                }
                                onPress={playItem}
                            />
                        ))}
                    </ScrollView>
                </>
            ) : null}

            <SectionHeader
                title={COPY.home.catalogTitle}
                subtitle={COPY.home.catalogSubtitle}
            />
        </View>
    );

    return (
        <View style={styles.screen}>
            <FlashList
                data={videos}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={header}
                renderItem={({item}) => (
                    <VideoItem
                        item={item}
                        onPress={playItem}
                        progress={progressById.get(item.id)}
                        active={item.id === currentVideo?.id}
                    />
                )}
                contentContainerStyle={{
                    paddingBottom: insets.bottom + SPACE.huge,
                }}
            />
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
    rail: {paddingHorizontal: SPACE.md},
});

export default Home;
