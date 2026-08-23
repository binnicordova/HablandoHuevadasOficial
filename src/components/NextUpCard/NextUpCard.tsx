import {Image} from "expo-image";
import {Pressable, StyleSheet, View} from "react-native";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {ELEVATION, HIT_SLOP, PRESS, RADII, SPACE} from "@/constants/theme";
import type {CatalogItem} from "@/models/video";
import {useTheme} from "@/theme/colors";
import {displayTitle} from "@/utils/format";
import {tapFeedback} from "@/utils/haptics";

type NextUpCardProps = {
    item: CatalogItem;
    /** Seconds left before it starts on its own. `null` while nothing is armed. */
    countdown: number | null;
    onPlay: (item: CatalogItem) => void;
    onCancel: () => void;
};

/**
 * The end-of-video handoff.
 *
 * A video that finishes and leaves the user staring at a still frame is a
 * session that just ended. This is the one component that decides otherwise —
 * always visible as a one-tap next, and armed with a visible countdown when a
 * clip actually ends. The countdown is deliberately cancellable and deliberately
 * slow enough to read: auto-advancing with no warning is how autoplay earns
 * itself a permanent trip to the settings screen.
 */
export const NextUpCard = ({
    item,
    countdown,
    onPlay,
    onCancel,
}: NextUpCardProps) => {
    const colors = useTheme();
    const counting = countdown !== null;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${COPY.player.nextUp}: ${displayTitle(item)}`}
            onPress={() => {
                tapFeedback();
                onPlay(item);
            }}
            style={({pressed}) => [
                styles.container,
                ELEVATION.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: counting ? colors.accent : colors.border,
                },
                pressed && styles.pressed,
            ]}
        >
            <View style={styles.thumbWrap}>
                <Image
                    source={item.thumbnail}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="disk"
                    recyclingKey={item.id}
                />
                <View
                    style={[styles.playBadge, {backgroundColor: colors.scrim}]}
                >
                    <Icon name="play" size={16} color={colors.text} />
                </View>
            </View>

            <View style={styles.body}>
                <Text variant="micro" tone={counting ? "accent" : "faint"}>
                    {(counting
                        ? COPY.player.nextUpIn(countdown)
                        : COPY.player.nextUp
                    ).toUpperCase()}
                </Text>
                <Text variant="label" numberOfLines={2}>
                    {displayTitle(item)}
                </Text>
                {counting ? null : (
                    <Text variant="caption" tone="faint" numberOfLines={1}>
                        {[item.season_short, item.duration_string]
                            .filter(Boolean)
                            .join(" · ") || COPY.player.nextUpHint}
                    </Text>
                )}
            </View>

            {counting ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={COPY.player.nextUpCancel}
                    hitSlop={HIT_SLOP}
                    onPress={() => {
                        tapFeedback();
                        onCancel();
                    }}
                    style={({pressed}) => [
                        styles.cancel,
                        {borderColor: colors.borderStrong},
                        pressed && styles.pressed,
                    ]}
                >
                    <Text variant="label" tone="muted">
                        {COPY.player.nextUpCancel}
                    </Text>
                </Pressable>
            ) : (
                <Icon name="chevron-right" size={22} color={colors.textFaint} />
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        marginHorizontal: SPACE.md,
        marginTop: SPACE.md,
        padding: SPACE.xs,
        paddingRight: SPACE.sm,
        borderRadius: RADII.md,
        borderWidth: 1,
    },
    pressed: {opacity: PRESS.opacity},
    thumbWrap: {
        width: 104,
        aspectRatio: 16 / 9,
        borderRadius: RADII.xs,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    playBadge: {
        width: 30,
        height: 30,
        borderRadius: RADII.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    body: {flex: 1, gap: 2},
    cancel: {
        paddingHorizontal: SPACE.sm,
        paddingVertical: SPACE.xs,
        borderRadius: RADII.pill,
        borderWidth: 1,
    },
});
