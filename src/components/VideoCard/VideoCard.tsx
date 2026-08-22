import {Image} from "expo-image";
import {LinearGradient} from "expo-linear-gradient";
import {Pressable, StyleSheet, View} from "react-native";
import {Text} from "@/components/Text/Text";
import {ELEVATION, PRESS, RADII, SPACE} from "@/constants/theme";
import type {CatalogItem} from "@/models/video";
import {ABSOLUTE_FILL} from "@/styles";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";

type VideoCardProps = {
    item: CatalogItem;
    onPress: (item: CatalogItem) => void;
    /** 0..1 resume progress. */
    progress?: number;
    width?: number;
};

/** Compact card for the horizontal rails. */
export const VideoCard = ({
    item,
    onPress,
    progress,
    width = 208,
}: VideoCardProps) => {
    const colors = useTheme();

    return (
        <Pressable
            style={({pressed}) => [
                styles.container,
                ELEVATION.card,
                {
                    width,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                },
                pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Reproducir: ${item.title}`}
            onPress={() => {
                tapFeedback();
                onPress(item);
            }}
        >
            <View style={styles.thumbWrap}>
                <Image
                    source={item.thumbnail}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="disk"
                    recyclingKey={item.id}
                />
                <LinearGradient
                    colors={["transparent", "rgba(5,5,7,0.8)"]}
                    style={styles.scrim}
                    pointerEvents="none"
                />
                {item.duration_string ? (
                    <View
                        style={[
                            styles.badge,
                            {backgroundColor: colors.overlay},
                        ]}
                    >
                        <Text variant="micro">{item.duration_string}</Text>
                    </View>
                ) : null}
                {typeof progress === "number" && progress > 0 ? (
                    <View
                        style={[
                            styles.track,
                            {backgroundColor: colors.borderStrong},
                        ]}
                    >
                        <View
                            style={[
                                styles.fill,
                                {
                                    width: `${Math.min(100, progress * 100)}%`,
                                    backgroundColor: colors.accent,
                                },
                            ]}
                        />
                    </View>
                ) : null}
            </View>
            <Text variant="label" numberOfLines={2} style={styles.title}>
                {item.title}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: RADII.md,
        borderWidth: 1,
        overflow: "hidden",
        marginRight: SPACE.sm,
    },
    pressed: {opacity: PRESS.opacity, transform: [{scale: PRESS.scale}]},
    thumbWrap: {width: "100%", aspectRatio: 16 / 9, justifyContent: "flex-end"},
    thumb: {...ABSOLUTE_FILL, width: "100%", height: "100%"},
    scrim: {...ABSOLUTE_FILL, top: "50%"},
    badge: {
        position: "absolute",
        right: SPACE.xxs + 2,
        top: SPACE.xxs + 2,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: RADII.xs,
    },
    track: {height: 3, width: "100%"},
    fill: {height: "100%"},
    title: {
        paddingHorizontal: SPACE.sm,
        paddingVertical: SPACE.xs,
        minHeight: 56,
    },
});
