import {Pressable, StyleSheet} from "react-native";
import {Icon, type IconName} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {PRESS, RADII, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {selectionFeedback} from "@/utils/haptics";

type ChipProps = {
    label: string;
    selected?: boolean;
    icon?: IconName;
    onPress: () => void;
};

export const Chip = ({label, selected = false, icon, onPress}: ChipProps) => {
    const colors = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{selected}}
            onPress={() => {
                selectionFeedback();
                onPress();
            }}
            style={({pressed}) => [
                styles.container,
                {
                    backgroundColor: selected
                        ? colors.accent
                        : colors.surfaceAlt,
                    borderColor: selected ? colors.accent : colors.border,
                },
                pressed && styles.pressed,
            ]}
        >
            {icon ? (
                <Icon
                    name={icon}
                    size={15}
                    color={selected ? colors.accentText : colors.textMuted}
                />
            ) : null}
            <Text
                variant="label"
                style={{color: selected ? colors.accentText : colors.text}}
            >
                {label}
            </Text>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    container: {
        // Chips live inside horizontal ScrollViews, whose content container
        // stretches children by default. A fixed height stops them rendering
        // as full-height pills.
        height: 40,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xxs,
        paddingHorizontal: SPACE.md,
        borderRadius: RADII.pill,
        borderWidth: 1,
    },
    pressed: {opacity: PRESS.opacity, transform: [{scale: PRESS.scale}]},
});
