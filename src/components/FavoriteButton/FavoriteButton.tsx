import {useAtomValue, useSetAtom} from "jotai";
import {
    Pressable,
    type StyleProp,
    StyleSheet,
    type ViewStyle,
} from "react-native";
import {Icon} from "@/components/Icon/Icon";
import {COPY} from "@/constants/copy";
import {HIT_SLOP, PRESS} from "@/constants/theme";
import {track} from "@/services/analytics";
import {favoriteIdsAtom, toggleFavoriteAtom} from "@/stores/store";
import {useTheme} from "@/theme/colors";
import {successFeedback, tapFeedback} from "@/utils/haptics";

type FavoriteButtonProps = {
    id: string;
    size?: number;
    style?: StyleProp<ViewStyle>;
    color?: string;
};

export const FavoriteButton = ({
    id,
    size = 22,
    style,
    color,
}: FavoriteButtonProps) => {
    const favorites = useAtomValue(favoriteIdsAtom);
    const toggleFavorite = useSetAtom(toggleFavoriteAtom);
    const colors = useTheme();
    const isFavorite = favorites.includes(id);

    return (
        <Pressable
            hitSlop={HIT_SLOP}
            style={({pressed}) => [style, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{selected: isFavorite}}
            // Kept literal: a screen reader should announce the action, not a joke.
            accessibilityLabel={
                isFavorite ? COPY.favorite.remove : COPY.favorite.add
            }
            onPress={() => {
                const added = toggleFavorite(id);
                track({
                    name: added ? "favorite_add" : "favorite_remove",
                    videoId: id,
                });
                if (added) successFeedback();
                else tapFeedback();
            }}
        >
            <Icon
                name={isFavorite ? "heart" : "heart-outline"}
                size={size}
                color={isFavorite ? colors.hot : (color ?? colors.textMuted)}
            />
        </Pressable>
    );
};

const styles = StyleSheet.create({
    pressed: {opacity: PRESS.opacity, transform: [{scale: 0.9}]},
});
