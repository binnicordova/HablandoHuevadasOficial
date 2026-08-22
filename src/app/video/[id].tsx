import {useLocalSearchParams, useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useMemo, useState} from "react";
import {ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {AppBar} from "@/components/AppBar/AppBar";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {SectionHeader} from "@/components/SectionHeader/SectionHeader";
import {ShareBar} from "@/components/ShareBar/ShareBar";
import {Text} from "@/components/Text/Text";
import {VideoCard} from "@/components/VideoCard/VideoCard";
import {VideoPlayer} from "@/components/VideoPlayer/VideoPlayer";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {SPACE} from "@/constants/theme";
import {useEngagement} from "@/hooks/useEngagement";
import {track} from "@/services/analytics";
import {getItemById, getRelated} from "@/services/catalog";
import {
    historyItemsAtom,
    recordWatchAtom,
    updateProgressAtom,
} from "@/stores/store";
import {formatViews} from "@/utils/format";

/**
 * Deep-link target for every shared clip. Opening a share link lands here with
 * the video already playing, which is what makes the share loop convert.
 */
const VideoDetail = () => {
    const {id} = useLocalSearchParams<{id: string}>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const engagement = useEngagement();
    const recordWatch = useSetAtom(recordWatchAtom);
    const updateProgress = useSetAtom(updateProgressAtom);
    const history = useAtomValue(historyItemsAtom);

    const item = useMemo(() => (id ? getItemById(id) : undefined), [id]);
    const related = useMemo(() => (id ? getRelated(id, 12) : []), [id]);
    const [playing, setPlaying] = useState(true);
    const [started, setStarted] = useState(false);

    const resumeAt = useMemo(
        () =>
            history.find((row) => row.entry.id === id)?.entry.positionSeconds ??
            0,
        [history, id]
    );

    const handleReady = useCallback(() => {
        if (started || !item) return;
        setStarted(true);
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
    }, [engagement, item, recordWatch, resumeAt, started]);

    const handleProgress = useCallback(
        (positionSeconds: number, durationSeconds: number) => {
            if (!item) return;
            updateProgress({id: item.id, positionSeconds, durationSeconds});
        },
        [item, updateProgress]
    );

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

    return (
        <ScrollView
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
                onReady={handleReady}
                onProgress={handleProgress}
                height={item.kind === "short" ? 420 : 220}
                onStateChange={(event) => {
                    if (event === "ended") setPlaying(false);
                    if (event === "playing") setPlaying(true);
                }}
            />

            <View style={styles.meta}>
                <Text variant="heading">{item.title}</Text>
                <View style={styles.metaRow}>
                    <Text variant="caption" tone="faint">
                        {formatViews(item.view_count)}
                    </Text>
                    <ShareBar
                        item={item}
                        source="detail"
                        onShared={engagement.recordShare}
                    />
                </View>
                {item.description ? (
                    <Text variant="body" tone="muted" numberOfLines={6}>
                        {item.description}
                    </Text>
                ) : null}
            </View>

            {related.length > 0 ? (
                <>
                    <SectionHeader title={COPY.player.related} />
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.rail}
                    >
                        {related.map((candidate) => (
                            <VideoCard
                                key={candidate.id}
                                item={candidate}
                                onPress={() =>
                                    router.push(PATHS.VIDEO(candidate.id))
                                }
                            />
                        ))}
                    </ScrollView>
                </>
            ) : null}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    meta: {paddingHorizontal: SPACE.md, paddingTop: SPACE.md, gap: SPACE.xs},
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.sm,
    },
    rail: {paddingHorizontal: SPACE.md},
});

export default VideoDetail;
