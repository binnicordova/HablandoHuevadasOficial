import {useLocalSearchParams, useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useMemo, useRef, useState} from "react";
import {ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppBar} from "@/components/AppBar/AppBar";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {Icon} from "@/components/Icon/Icon";
import {NextUpCard} from "@/components/NextUpCard/NextUpCard";
import {ShareBar} from "@/components/ShareBar/ShareBar";
import {Text} from "@/components/Text/Text";
import {VideoPlayer} from "@/components/VideoPlayer/VideoPlayer";
import {VideoRail} from "@/components/VideoRail/VideoRail";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {RADII, SPACE} from "@/constants/theme";
import {useEngagement} from "@/hooks/useEngagement";
import {useNextUp} from "@/hooks/useNextUp";
import {useOpenItem} from "@/hooks/useOpenItem";
import type {CatalogItem} from "@/models/video";
import {track} from "@/services/analytics";
import {getItemById} from "@/services/catalog";
import {detailRails, type Rail} from "@/services/recommendations";
import {
    favoriteIdsAtom,
    historyAtom,
    recordWatchAtom,
    shortsCatalogAtom,
    updateProgressAtom,
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
 * Deep-link target for every shared clip, and the room where a session either
 * continues or dies.
 *
 * Two rules hold this screen together:
 *
 * Following a related clip rewrites this screen's own `id` param instead of
 * pushing a second copy of itself. Every instance owns a YouTube webview, so
 * pushing would leave a stack of live embeds behind the one on screen, each
 * holding its memory and its player, and the new one would cold boot the iframe
 * from nothing. Swapping the param keeps a single mounted player and hands it a
 * new video id, which the embed loads in place — and the back button still goes
 * back to wherever the user actually came from.
 *
 * And nothing below the player is ever empty. The rails come from the same
 * engine as Inicio, re-anchored on the clip being watched.
 */
const VideoDetail = () => {
    const {id} = useLocalSearchParams<{id: string}>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colors = useTheme();
    const engagement = useEngagement();
    const openItem = useOpenItem();

    const videos = useAtomValue(videosAtom);
    const shorts = useAtomValue(shortsCatalogAtom);
    const history = useAtomValue(historyAtom);
    const favoriteIds = useAtomValue(favoriteIdsAtom);
    const progressById = useAtomValue(watchProgressAtom);
    const recordWatch = useSetAtom(recordWatchAtom);
    const updateProgress = useSetAtom(updateProgressAtom);

    const scrollRef = useRef<ScrollView>(null);
    /** The last id counted as a play, so a swap re-arms the tracking. */
    const startedRef = useRef<string | null>(null);

    const item = useMemo(() => (id ? getItemById(id) : undefined), [id]);
    const [playing, setPlaying] = useState(true);

    const rails = useMemo(
        (): Rail[] =>
            item
                ? detailRails({
                      videos,
                      shorts,
                      history,
                      favoriteIds,
                      current: item,
                  })
                : [],
        [item, videos, shorts, history, favoriteIds]
    );

    const resumeAt = useMemo(
        () => history.find((entry) => entry.id === id)?.positionSeconds ?? 0,
        [history, id]
    );

    /**
     * Counts the play and opens the history entry, once per clip.
     *
     * Fired from both `onReady` and the first `playing` state on purpose: the
     * embed only ever reports ready once per webview, so a clip swapped into
     * the live player would otherwise never reach the history — and with it
     * "seguir viendo", the resume position and the taste profile.
     */
    const markStarted = useCallback(() => {
        if (!item || startedRef.current === item.id) return;
        startedRef.current = item.id;
        engagement.recordPlay();
        track({
            name: "play_start",
            videoId: item.id,
            kind: item.kind,
            surface: "detail",
        });
        recordWatch({
            id: item.id,
            kind: item.kind,
            positionSeconds: resumeAt,
            durationSeconds: item.duration ?? 0,
        });
    }, [engagement, item, recordWatch, resumeAt]);

    const handleProgress = useCallback(
        (positionSeconds: number, durationSeconds: number) => {
            if (!item) return;
            updateProgress({id: item.id, positionSeconds, durationSeconds});
        },
        [item, updateProgress]
    );

    /** Same screen, new clip: rewrite the param and ride back up to the player. */
    const swapTo = useCallback(
        (next: CatalogItem, surface = "detail") => {
            if (next.id === id) return;
            router.setParams({id: next.id});
            setPlaying(true);
            track({
                name: "rail_open",
                rail: surface,
                videoId: next.id,
                position: 0,
            });
            scrollRef.current?.scrollTo({y: 0, animated: true});
        },
        [id, router]
    );

    /** Episodes swap in place; shorts belong to the vertical feed. */
    const playFromRail = useCallback(
        (next: CatalogItem) => {
            if (next.kind === "short") {
                openItem(next);
                return;
            }
            swapTo(next, "detail:rail");
        },
        [openItem, swapTo]
    );

    const playNext = useCallback(
        (next: CatalogItem) => swapTo(next, "detail:autoplay"),
        [swapTo]
    );

    const handoff = useNextUp({
        rails,
        kind: item?.kind,
        excludeId: item?.id,
        onAdvance: playNext,
    });

    if (!item) {
        return (
            <View style={[styles.screen, {paddingTop: insets.top}]}>
                <AppBar title={COPY.appName} />
                <EmptyState
                    icon="video-off-outline"
                    title={COPY.error.videoGoneTitle}
                    message={COPY.error.videoGoneBody}
                    actionLabel={COPY.error.goHome}
                    onAction={() => router.replace(PATHS.HOME)}
                />
            </View>
        );
    }

    const meta = [
        item.season,
        formatDuration(item.duration) || item.duration_string,
        formatViews(item.view_count),
        formatLikes(item.like_count),
    ].filter(Boolean);

    return (
        <ScrollView
            ref={scrollRef}
            style={styles.screen}
            contentContainerStyle={{paddingBottom: insets.bottom + SPACE.xxl}}
        >
            <View style={{paddingTop: insets.top}}>
                <AppBar title={COPY.appName} />
            </View>

            <VideoPlayer
                videoId={item.id}
                playing={playing}
                startAt={resumeAt}
                poster={item.thumbnail}
                onReady={markStarted}
                onProgress={handleProgress}
                height={item.kind === "short" ? 420 : 220}
                onStateChange={(event) => {
                    if (event === "playing") {
                        setPlaying(true);
                        handoff.clear();
                        markStarted();
                    }
                    if (event === "ended") {
                        setPlaying(false);
                        handoff.arm();
                    }
                }}
            />

            <View style={styles.meta}>
                <View style={styles.titleRow}>
                    {item.season_short ? (
                        <View
                            style={[
                                styles.seasonChip,
                                {borderColor: colors.borderStrong},
                            ]}
                        >
                            <Text variant="micro" tone="muted">
                                {item.season_short}
                            </Text>
                        </View>
                    ) : null}
                    {resumeAt > 5 ? (
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
                    ) : null}
                </View>

                <Text variant="heading">{displayTitle(item)}</Text>

                {meta.length > 0 ? (
                    <Text variant="caption" tone="faint">
                        {meta.join(" · ")}
                    </Text>
                ) : null}

                {item.description ? (
                    <Text
                        variant="body"
                        tone="muted"
                        numberOfLines={4}
                        style={styles.description}
                    >
                        {item.description}
                    </Text>
                ) : null}

                <View style={[styles.actions, {borderTopColor: colors.border}]}>
                    <ShareBar
                        item={item}
                        source="detail"
                        onShared={engagement.recordShare}
                    />
                </View>
            </View>

            {handoff.item ? (
                <NextUpCard
                    item={handoff.item}
                    countdown={handoff.countdown}
                    onPlay={(next) => swapTo(next, "detail:nextup")}
                    onCancel={handoff.dismiss}
                />
            ) : null}

            {rails.map((rail) => (
                <VideoRail
                    key={rail.id}
                    rail={rail}
                    progressById={progressById}
                    onPress={playFromRail}
                    actionLabel={COPY.rails.seeAll}
                    onAction={
                        rail.action === "shorts"
                            ? () => router.push(PATHS.SHORTS)
                            : undefined
                    }
                />
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    meta: {paddingHorizontal: SPACE.md, paddingTop: SPACE.md, gap: SPACE.xs},
    titleRow: {flexDirection: "row", alignItems: "center", gap: SPACE.xs},
    seasonChip: {
        paddingHorizontal: SPACE.xs,
        paddingVertical: 3,
        borderRadius: RADII.xs,
        borderWidth: 1,
    },
    resume: {flexDirection: "row", alignItems: "center", gap: SPACE.xxs},
    description: {marginTop: SPACE.xxs},
    actions: {
        marginTop: SPACE.xs,
        paddingTop: SPACE.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});

export default VideoDetail;
