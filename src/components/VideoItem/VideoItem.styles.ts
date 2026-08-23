import {StyleSheet} from "react-native";
import {RADII, SPACE} from "@/constants/theme";
import {ABSOLUTE_FILL} from "@/styles";

export const styles = StyleSheet.create({
    container: {
        marginHorizontal: SPACE.md,
        marginBottom: SPACE.sm,
        borderRadius: RADII.lg,
        borderWidth: 1,
        overflow: "hidden",
    },
    active: {borderWidth: 2},
    pressed: {opacity: 0.9, transform: [{scale: 0.99}]},
    thumbnailWrap: {
        width: "100%",
        aspectRatio: 16 / 9,
        justifyContent: "flex-end",
    },
    thumbnail: {...ABSOLUTE_FILL, width: "100%", height: "100%"},
    scrim: {...ABSOLUTE_FILL, top: "45%"},
    playBadge: {
        position: "absolute",
        left: SPACE.sm,
        bottom: SPACE.sm,
        width: 36,
        height: 36,
        borderRadius: RADII.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    nowPlaying: {
        position: "absolute",
        left: SPACE.sm,
        bottom: SPACE.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: SPACE.xs,
        paddingVertical: 5,
        borderRadius: RADII.pill,
    },
    durationBadge: {
        position: "absolute",
        right: SPACE.xs,
        top: SPACE.xs,
        paddingHorizontal: SPACE.xxs + 2,
        paddingVertical: 3,
        borderRadius: RADII.xs,
    },
    progressTrack: {height: 3, width: "100%"},
    progressFill: {height: "100%"},
    textContainer: {
        gap: SPACE.xxs,
        paddingHorizontal: SPACE.sm,
        paddingTop: SPACE.sm,
        paddingBottom: SPACE.sm,
    },
    titleRow: {flexDirection: "row", alignItems: "flex-start", gap: SPACE.xs},
    metaRow: {flexDirection: "row", alignItems: "center", gap: SPACE.xxs},
    seasonChip: {
        paddingHorizontal: SPACE.xxs + 2,
        paddingVertical: 2,
        borderRadius: RADII.xs,
        borderWidth: 1,
    },
    title: {flex: 1},
    favorite: {paddingTop: 2},
});
