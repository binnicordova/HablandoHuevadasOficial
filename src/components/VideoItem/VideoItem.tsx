import {Image} from "expo-image";
import {LinearGradient} from "expo-linear-gradient";
import {Pressable, View} from "react-native";
import {FavoriteButton} from "@/components/FavoriteButton/FavoriteButton";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {ELEVATION} from "@/constants/theme";
import type {CatalogItem} from "@/models/video";
import {useTheme} from "@/theme/colors";
import {formatViews} from "@/utils/format";
import {tapFeedback} from "@/utils/haptics";
import {styles} from "./VideoItem.styles";

type VideoItemProps = {
    item: CatalogItem;
    onPress: (item: CatalogItem) => void;
    /** 0..1. Renders the resume bar under the cover when present. */
    progress?: number;
    active?: boolean;
};

export const VideoItem = ({
    item,
    onPress,
    progress,
    active,
}: VideoItemProps) => {
    const colors = useTheme();

    return (
        <Pressable
            style={({pressed}) => [
                styles.container,
                ELEVATION.card,
                {
                    backgroundColor: colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                },
                active && styles.active,
                pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Reproducir: ${item.title}`}
            onPress={() => {
                tapFeedback();
                onPress(item);
            }}
        >
            <View style={styles.thumbnailWrap}>
                <Image
                    source={item.thumbnail}
                    style={styles.thumbnail}
                    contentFit="cover"
                    transition={180}
                    cachePolicy="disk"
                    recyclingKey={item.id}
                />
                <LinearGradient
                    colors={["transparent", "rgba(5,5,7,0.85)"]}
                    style={styles.scrim}
                    pointerEvents="none"
                />

                {active ? (
                    <View
                        style={[
                            styles.nowPlaying,
                            {backgroundColor: colors.accent},
                        ]}
                    >
                        <Icon
                            name="waveform"
                            size={13}
                            color={colors.accentText}
                        />
                        <Text variant="micro" tone="inverse">
                            SONANDO
                        </Text>
                    </View>
                ) : (
                    <View
                        style={[
                            styles.playBadge,
                            {backgroundColor: colors.scrim},
                        ]}
                    >
                        <Icon name="play" size={18} color={colors.text} />
                    </View>
                )}

                {item.duration_string ? (
                    <View
                        style={[
                            styles.durationBadge,
                            {backgroundColor: colors.overlay},
                        ]}
                    >
                        <Text variant="micro">{item.duration_string}</Text>
                    </View>
                ) : null}

                {typeof progress === "number" && progress > 0 ? (
                    <View
                        style={[
                            styles.progressTrack,
                            {backgroundColor: colors.borderStrong},
                        ]}
                    >
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${Math.min(100, progress * 100)}%`,
                                    backgroundColor: colors.accent,
                                },
                            ]}
                        />
                    </View>
                ) : null}
            </View>

            <View style={styles.textContainer}>
                <View style={styles.titleRow}>
                    <Text
                        variant="subheading"
                        numberOfLines={2}
                        style={styles.title}
                    >
                        {item.title}
                    </Text>
                    <FavoriteButton
                        id={item.id}
                        size={22}
                        style={styles.favorite}
                    />
                </View>
                <Text variant="caption" tone="faint">
                    {formatViews(item.view_count)}
                </Text>
            </View>
        </Pressable>
    );
};
