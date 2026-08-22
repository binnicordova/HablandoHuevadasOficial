import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {Icon, type IconName} from "@/components/Icon/Icon";
import {
    ELEVATION,
    MIN_TOUCH,
    PRESS,
    RADII,
    SPACE,
    TYPE,
} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";

export type ButtonProps = {
    title: string;
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "md" | "lg";
    icon?: IconName;
    fullWidth?: boolean;
    accessibilityLabel?: string;
    testID?: string;
};

export const Button = ({
    title,
    onPress,
    disabled,
    loading = false,
    variant = "primary",
    size = "md",
    icon,
    fullWidth = true,
    accessibilityLabel,
    testID,
}: ButtonProps) => {
    const colors = useTheme();
    const isDisabled = disabled || loading;

    const background = {
        primary: colors.accent,
        secondary: colors.surfaceAlt,
        ghost: "transparent",
        danger: colors.hot,
    }[variant];

    const foreground = {
        primary: colors.accentText,
        secondary: colors.text,
        ghost: colors.text,
        danger: colors.text,
    }[variant];

    return (
        <Pressable
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? title}
            accessibilityState={{disabled: !!isDisabled, busy: loading}}
            style={({pressed}) => [
                styles.base,
                size === "lg" ? styles.lg : styles.md,
                {backgroundColor: background},
                fullWidth ? styles.fullWidth : styles.hug,
                variant === "ghost" && {
                    borderWidth: 1,
                    borderColor: colors.borderStrong,
                },
                variant === "primary" && !isDisabled && ELEVATION.glow,
                variant === "danger" && !isDisabled && ELEVATION.glowHot,
                pressed && !isDisabled && styles.pressed,
                isDisabled && styles.disabled,
            ]}
            onPress={
                isDisabled
                    ? undefined
                    : () => {
                          tapFeedback();
                          onPress?.();
                      }
            }
            disabled={isDisabled}
        >
            {loading ? (
                <ActivityIndicator color={foreground} />
            ) : (
                <View style={styles.content}>
                    {icon ? (
                        <Icon name={icon} size={18} color={foreground} />
                    ) : null}
                    <Text
                        style={[TYPE.label, styles.text, {color: foreground}]}
                    >
                        {title}
                    </Text>
                </View>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: RADII.md,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: SPACE.lg,
    },
    md: {minHeight: MIN_TOUCH},
    lg: {minHeight: 56, borderRadius: RADII.lg},
    fullWidth: {alignSelf: "stretch"},
    hug: {alignSelf: "flex-start"},
    content: {flexDirection: "row", alignItems: "center", gap: SPACE.xs},
    text: {textAlign: "center"},
    pressed: {opacity: PRESS.opacity, transform: [{scale: PRESS.scale}]},
    disabled: {opacity: 0.4},
});
