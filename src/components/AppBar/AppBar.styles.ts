import {StyleSheet} from "react-native";
import {MIN_TOUCH, RADII, SPACE} from "@/constants/theme";

export const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        paddingHorizontal: SPACE.md,
        paddingVertical: SPACE.xs,
        minHeight: MIN_TOUCH + SPACE.xs,
    },
    back: {
        width: MIN_TOUCH - 8,
        height: MIN_TOUCH - 8,
        borderRadius: RADII.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {flex: 1},
});
