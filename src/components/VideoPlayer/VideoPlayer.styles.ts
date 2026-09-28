import {StyleSheet} from "react-native";
import {RADII, SPACE} from "@/constants/theme";

export const styles = StyleSheet.create({
    container: {
        width: "100%",
        overflow: "hidden",
    },
    /** Centres the over-wide iframe so the pillarbox is cropped evenly. */
    fillContainer: {
        alignItems: "center",
        justifyContent: "center",
    },
    flexFull: {width: "100%"},
    premiereBadge: {
        position: "absolute",
        top: SPACE.xs,
        left: SPACE.xs,
        paddingHorizontal: SPACE.sm,
        paddingVertical: SPACE.xxs,
        borderRadius: RADII.pill,
    },
});
