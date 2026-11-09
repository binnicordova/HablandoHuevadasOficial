import {StyleSheet} from "react-native";
import {MIN_TOUCH, PRESS, RADII, SPACE} from "@/constants/theme";

const SIZE = MIN_TOUCH + 8;

export const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: SPACE.lg,
        right: SPACE.md,
        height: SIZE,
        borderRadius: RADII.pill,
        justifyContent: "center",
        alignItems: "center",
    },
    circle: {width: SIZE},
    /** Grows leftwards from the same right edge, so it never jumps. */
    extended: {
        minWidth: SIZE,
        paddingHorizontal: SPACE.md,
        flexDirection: "row",
        gap: SPACE.xs,
    },
    text: {fontVariant: ["tabular-nums"]},
    ring: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: RADII.pill,
    },
    pressed: {opacity: PRESS.opacity, transform: [{scale: 0.94}]},
});
