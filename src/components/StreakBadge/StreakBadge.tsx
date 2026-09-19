import {Pressable, StyleSheet, View} from "react-native";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {ELEVATION, PRESS, RADII, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

type StreakBadgeProps = {
    streak: number;
    best?: number;
    nextMilestone?: number;
    variant?: "compact" | "card";
    onPress?: () => void;
};

export const StreakBadge = ({
    streak,
    best,
    nextMilestone,
    variant = "compact",
    onPress,
}: StreakBadgeProps) => {
    const colors = useTheme();
    const active = streak > 0;
    const flame = active ? colors.hot : colors.textFaint;

    if (variant === "compact") {
        return (
            <Pressable
                onPress={onPress}
                accessibilityRole={onPress ? "button" : "text"}
                accessibilityLabel={COPY.me.streakDays(streak)}
                style={({pressed}) => [
                    styles.compact,
                    {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                    },
                    active && ELEVATION.glowHot,
                    pressed && styles.pressed,
                ]}
            >
                <Icon name="fire" size={16} color={flame} />
                <Text variant="label">{streak}</Text>
            </Pressable>
        );
    }

    const progress =
        nextMilestone && nextMilestone > 0
            ? Math.min(1, streak / nextMilestone)
            : 0;
    const remaining = nextMilestone ? Math.max(0, nextMilestone - streak) : 0;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole={onPress ? "button" : "text"}
            style={[
                styles.card,
                ELEVATION.card,
                {backgroundColor: colors.surface, borderColor: colors.border},
            ]}
        >
            <View style={styles.cardHeader}>
                <View
                    style={[
                        styles.flameWrap,
                        {backgroundColor: colors.surfaceAlt},
                    ]}
                >
                    <Icon name="fire" size={26} color={flame} />
                </View>
                <View style={styles.cardHeaderText}>
                    <Text variant="title">{COPY.me.streakDays(streak)}</Text>
                    {typeof best === "number" ? (
                        <Text variant="caption" tone="faint">
                            {COPY.me.streakBest(best)}
                        </Text>
                    ) : null}
                </View>
            </View>

            {nextMilestone ? (
                <>
                    <View
                        style={[
                            styles.track,
                            {backgroundColor: colors.surfaceAlt},
                        ]}
                    >
                        <View
                            style={[
                                styles.fill,
                                {
                                    width: `${progress * 100}%`,
                                    backgroundColor: colors.hot,
                                },
                            ]}
                        />
                    </View>
                    <Text variant="caption" tone="muted">
                        {COPY.me.streakToGo(remaining)}
                    </Text>
                </>
            ) : null}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    compact: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xxs,
        height: 36,
        paddingHorizontal: SPACE.sm,
        borderRadius: RADII.pill,
        borderWidth: 1,
    },
    pressed: {opacity: PRESS.opacity, transform: [{scale: PRESS.scale}]},
    card: {
        marginHorizontal: SPACE.md,
        borderRadius: RADII.lg,
        borderWidth: 1,
        padding: SPACE.md,
        gap: SPACE.sm,
    },
    cardHeader: {flexDirection: "row", alignItems: "center", gap: SPACE.sm},
    flameWrap: {
        width: 48,
        height: 48,
        borderRadius: RADII.md,
        alignItems: "center",
        justifyContent: "center",
    },
    cardHeaderText: {flex: 1, gap: 2},
    track: {height: 8, borderRadius: RADII.pill, overflow: "hidden"},
    fill: {height: "100%", borderRadius: RADII.pill},
});
