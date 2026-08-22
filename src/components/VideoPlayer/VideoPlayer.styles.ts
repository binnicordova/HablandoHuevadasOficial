import {StyleSheet} from "react-native";

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
});
