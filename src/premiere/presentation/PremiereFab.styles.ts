import {StyleSheet} from "react-native";
import {MIN_TOUCH, RADII, SPACE} from "@/constants/theme";

export const BUBBLE_GAP = SPACE.sm;
export const FAB_SIZE = MIN_TOUCH + 8;

export const styles = StyleSheet.create({
    bubble: {
        position: "absolute",
        right: SPACE.md,
        maxWidth: 260,
        paddingHorizontal: SPACE.md,
        paddingVertical: SPACE.sm,
        borderRadius: RADII.lg,
        borderWidth: StyleSheet.hairlineWidth,
    },
});
