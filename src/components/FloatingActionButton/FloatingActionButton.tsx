import {useEffect} from "react";
import {Pressable} from "react-native";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import {Icon, type IconName} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {ELEVATION} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";
import {styles} from "./FloatingActionButton.styles";

const PULSE_MS = {calm: 1600, urgent: 700} as const;

type FloatingActionButtonProps = {
    onPress: () => void;
    icon?: IconName;
    /** Accessibility label — the button itself is icon-only unless `text`. */
    label?: string;
    bottom?: number;
    /** Fill colour, so a second stacked FAB can read as its own action
     *  instead of a duplicate of the first. Defaults to the usual accent. */
    tint?: string;
    tintText?: string;
    /** Turns the circle into a pill: the icon followed by this text. */
    text?: string;
    /** A soft ring that breathes outwards; ignored under reduce-motion. */
    pulse?: keyof typeof PULSE_MS;
};

export const FloatingActionButton = ({
    onPress,
    icon = "shuffle-variant",
    label = COPY.home.shuffle,
    bottom,
    tint,
    tintText,
    text,
    pulse,
}: FloatingActionButtonProps) => {
    const colors = useTheme();
    const reduceMotion = useReducedMotion();
    const fill = tint ?? colors.accent;
    const ink = tintText ?? colors.accentText;

    const phase = useSharedValue(0);
    const animated = pulse !== undefined && !reduceMotion;
    useEffect(() => {
        if (!animated) {
            cancelAnimation(phase);
            phase.value = 0;
            return;
        }
        phase.value = 0;
        phase.value = withRepeat(
            withTiming(1, {
                duration: PULSE_MS[pulse],
                easing: Easing.out(Easing.quad),
            }),
            -1,
            false
        );
        return () => cancelAnimation(phase);
    }, [animated, pulse, phase]);

    const ringStyle = useAnimatedStyle(() => ({
        opacity: 0.45 * (1 - phase.value),
        transform: [{scale: 1 + 0.35 * phase.value}],
    }));

    return (
        <Pressable
            style={({pressed}) => [
                styles.container,
                text === undefined ? styles.circle : styles.extended,
                ELEVATION.glow,
                {backgroundColor: fill},
                bottom !== undefined && {bottom},
                pressed && styles.pressed,
            ]}
            onPress={() => {
                tapFeedback();
                onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            {animated ? (
                <Animated.View
                    pointerEvents="none"
                    style={[styles.ring, {backgroundColor: fill}, ringStyle]}
                />
            ) : null}
            <Icon name={icon} size={26} color={ink} />
            {text === undefined ? null : (
                <Text
                    variant="label"
                    style={[styles.text, {color: ink}]}
                    importantForAccessibility="no"
                >
                    {text}
                </Text>
            )}
        </Pressable>
    );
};
