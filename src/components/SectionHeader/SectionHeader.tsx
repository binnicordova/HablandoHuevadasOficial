import {Pressable, StyleSheet, View} from "react-native";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {HIT_SLOP, PRESS, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";

type SectionHeaderProps = {
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
};

export const SectionHeader = ({
    title,
    subtitle,
    actionLabel,
    onAction,
}: SectionHeaderProps) => {
    const colors = useTheme();

    return (
        <View style={styles.container}>
            <View style={styles.titles}>
                <Text variant="heading">{title}</Text>
                {subtitle ? (
                    <Text
                        variant="caption"
                        tone="faint"
                        style={styles.subtitle}
                    >
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            {actionLabel && onAction ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                    hitSlop={HIT_SLOP}
                    style={({pressed}) => [
                        styles.action,
                        pressed && styles.pressed,
                    ]}
                    onPress={() => {
                        tapFeedback();
                        onAction();
                    }}
                >
                    <Text variant="label" tone="accent">
                        {actionLabel}
                    </Text>
                    <Icon
                        name="chevron-right"
                        size={18}
                        color={colors.accent}
                    />
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.md,
        paddingHorizontal: SPACE.md,
        paddingTop: SPACE.xl,
        paddingBottom: SPACE.sm,
    },
    titles: {flex: 1, gap: 2},
    subtitle: {},
    action: {flexDirection: "row", alignItems: "center", gap: 2},
    pressed: {opacity: PRESS.opacity},
});
