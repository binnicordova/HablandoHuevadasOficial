import {StyleSheet} from "react-native";
import {MIN_TOUCH, PRESS, RADII, SPACE} from "@/constants/theme";

export const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: SPACE.lg,
        right: SPACE.md,
        width: MIN_TOUCH + 8,
        height: MIN_TOUCH + 8,
        borderRadius: RADII.pill,
        justifyContent: "center",
        alignItems: "center",
    },
    pressed: {opacity: PRESS.opacity, transform: [{scale: 0.94}]},
});
