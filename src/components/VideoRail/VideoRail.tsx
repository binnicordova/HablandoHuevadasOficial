import {FlatList, StyleSheet} from "react-native";
import {SectionHeader} from "@/components/SectionHeader/SectionHeader";
import {VideoCard} from "@/components/VideoCard/VideoCard";
import {SPACE} from "@/constants/theme";
import type {CatalogItem} from "@/models/video";
import {track} from "@/services/analytics";
import type {Rail} from "@/services/recommendations";

type VideoRailProps = {
    rail: Rail;
    onPress: (item: CatalogItem, rail: Rail) => void;
    /** Resume progress by id, so a rail can show the bar the list shows. */
    progressById?: Map<string, number>;
    actionLabel?: string;
    onAction?: () => void;
    cardWidth?: number;
};

/**
 * One horizontal carousel — header, cards, tracking.
 *
 * Every surface that shows a row of clips goes through here: Inicio, Guardados,
 * Mi zona and the detail screen used to hand-roll the same
 * `SectionHeader` + `ScrollView horizontal` + `VideoCard.map()` block, which is
 * how four rails end up with three different paddings and zero analytics.
 *
 * `FlatList` rather than `ScrollView` on purpose: Inicio stacks up to eight of
 * these, and mounting ~100 remote thumbnails at once is a jank machine on a
 * mid-range Android. This way each rail keeps a handful alive.
 */
export const VideoRail = ({
    rail,
    onPress,
    progressById,
    actionLabel,
    onAction,
    cardWidth,
}: VideoRailProps) => {
    if (rail.items.length === 0) return null;

    return (
        <>
            <SectionHeader
                title={rail.title}
                subtitle={rail.subtitle}
                actionLabel={onAction ? actionLabel : undefined}
                onAction={onAction}
            />
            <FlatList
                horizontal
                data={rail.items}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.content}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={3}
                removeClippedSubviews
                renderItem={({item, index}) => (
                    <VideoCard
                        item={item}
                        width={cardWidth}
                        progress={progressById?.get(item.id)}
                        onPress={() => {
                            track({
                                name: "rail_open",
                                rail: rail.id,
                                videoId: item.id,
                                position: index,
                            });
                            onPress(item, rail);
                        }}
                    />
                )}
            />
        </>
    );
};

const styles = StyleSheet.create({
    content: {paddingHorizontal: SPACE.md},
});
