import {LinearGradient} from "expo-linear-gradient";
import {useIsFocused} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useRef, useState} from "react";
import {
    FlatList,
    StyleSheet,
    useWindowDimensions,
    View,
    type ViewToken,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {ShareBar} from "@/components/ShareBar/ShareBar";
import {Text} from "@/components/Text/Text";
import {VideoPlayer} from "@/components/VideoPlayer/VideoPlayer";
import {SPACE} from "@/constants/theme";
import {useEngagement} from "@/hooks/useEngagement";
import type {CatalogItem} from "@/models/video";
import {track} from "@/services/analytics";
import {recordWatchAtom, shortsAtom} from "@/stores/store";
import {formatViews} from "@/utils/format";

/** Height of the default bottom tab bar, which sits over the feed. */
const TAB_BAR_HEIGHT = 56;

const Shorts = () => {
    const shorts = useAtomValue(shortsAtom);
    const recordWatch = useSetAtom(recordWatchAtom);
    const engagement = useEngagement();

    const {height, width} = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isFocused = useIsFocused();
    const [currentId, setCurrentId] = useState<string | null>(
        shorts[0]?.id ?? null
    );

    const pageHeight = height;
    const overlayBottom = insets.bottom + TAB_BAR_HEIGHT + SPACE.md;

    const onViewableItemsChanged = useCallback(
        ({viewableItems}: {viewableItems: ViewToken[]}) => {
            const first = viewableItems[0]?.item as CatalogItem | undefined;
            if (!first) return;
            setCurrentId(first.id);
            engagement.recordPlay();
            track({
                name: "play_start",
                videoId: first.id,
                kind: "short",
                surface: "shorts",
            });
            recordWatch({
                id: first.id,
                kind: "short",
                positionSeconds: 0,
                durationSeconds: first.duration ?? 0,
            });
        },
        [engagement, recordWatch]
    );

    const viewabilityConfigCallbackPairs = useRef([
        {
            viewabilityConfig: {itemVisiblePercentThreshold: 60},
            onViewableItemsChanged,
        },
    ]);

    return (
        <View style={styles.screen}>
            <FlatList
                data={shorts}
                keyExtractor={(item) => item.id}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                windowSize={3}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                removeClippedSubviews
                getItemLayout={(_data, index) => ({
                    length: pageHeight,
                    offset: pageHeight * index,
                    index,
                })}
                viewabilityConfigCallbackPairs={
                    viewabilityConfigCallbackPairs.current
                }
                renderItem={({item}) => (
                    <View style={[styles.page, {height: pageHeight, width}]}>
                        <VideoPlayer
                            videoId={item.id}
                            // Only the visible short plays, and everything stops
                            // when the user leaves the tab.
                            playing={isFocused && currentId === item.id}
                            height={pageHeight}
                            poster={item.thumbnail}
                            fill
                        />

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
                                    {item.title}
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
                )}
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
    topScrim: {position: "absolute", top: 0, left: 0, right: 0},
    bottomScrim: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 220,
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
