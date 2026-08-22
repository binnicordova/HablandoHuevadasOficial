import {useEffect} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import type {SoundPadSpec} from "@/constants/soundboard";
import {ELEVATION, MIN_TOUCH, RADII, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

type SoundPadProps = {
    spec: SoundPadSpec;
    active: boolean;
    failed: boolean;
    onPress: (spec: SoundPadSpec) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A soundboard pad. Punchy on purpose: it dips and springs back on every tap so
 * the grid feels like hardware rather than a list of buttons.
 */
export const SoundPad = ({spec, active, failed, onPress}: SoundPadProps) => {
    const colors = useTheme();
    const scale = useSharedValue(1);
    const locked = !spec.source;

    const tone = {
        lime: colors.accent,
        hot: colors.hot,
        cyan: colors.info,
    }[spec.tone];

    useEffect(() => {
        if (!active) return;
        scale.value = withSequence(
            withTiming(0.94, {duration: 70}),
            withTiming(1, {duration: 180})
        );
    }, [active, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{scale: scale.value}],
    }));

    return (
        <AnimatedPressable
            accessibilityRole="button"
            accessibilityState={{disabled: locked, selected: active}}
            accessibilityLabel={
                locked ? `${spec.label}. ${COPY.soundboard.locked}` : spec.label
            }
            onPress={() => onPress(spec)}
            style={[
                styles.pad,
                animatedStyle,
                {
                    backgroundColor: colors.surface,
                    borderColor: active ? tone : colors.border,
                },
                active && [
                    {borderWidth: 2},
                    ELEVATION.glow,
                    {shadowColor: tone},
                ],
                locked && styles.locked,
            ]}
        >
            <View
                style={[
                    styles.iconWrap,
                    {backgroundColor: active ? tone : colors.surfaceAlt},
                ]}
            >
                <Icon
                    name={
                        locked
                            ? "lock-outline"
                            : active
                              ? "volume-high"
                              : "play"
                    }
                    size={20}
                    color={
                        active
                            ? colors.accentText
                            : locked
                              ? colors.textFaint
                              : tone
                    }
                />
            </View>

            <View style={styles.labels}>
                <Text variant="label" numberOfLines={2}>
                    {spec.label}
                </Text>
                <Text
                    variant="micro"
                    tone={failed ? "error" : "faint"}
                    numberOfLines={1}
                >
                    {failed
                        ? COPY.soundboard.playbackFailed
                        : locked
                          ? COPY.soundboard.locked
                          : (spec.hint ?? "")}
                </Text>
            </View>
        </AnimatedPressable>
    );
};

const styles = StyleSheet.create({
    pad: {
        flex: 1,
        minHeight: MIN_TOUCH * 2,
        borderRadius: RADII.lg,
        borderWidth: 1,
        padding: SPACE.sm,
        gap: SPACE.xs,
        justifyContent: "space-between",
    },
    locked: {opacity: 0.45},
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: RADII.sm,
        alignItems: "center",
        justifyContent: "center",
    },
    labels: {gap: 2},
});
