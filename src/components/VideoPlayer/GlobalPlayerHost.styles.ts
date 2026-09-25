import {StyleSheet} from "react-native";

export const styles = StyleSheet.create({
    /**
     * `box-none`: the wrapper itself must never swallow a touch meant for
     * whatever screen is underneath — only the player box and its own
     * buttons should ever respond.
     */
    overlay: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0},
    box: {position: "absolute", overflow: "hidden"},
    stageFade: {position: "absolute", left: 0, right: 0, bottom: 0, height: 24},
    pipShadow: {
        shadowColor: "#000000",
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: 0.5,
        shadowRadius: 18,
        elevation: 10,
    },
    pipButton: {
        position: "absolute",
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(5,5,7,0.72)",
    },
    closeButton: {top: 6, right: 6},
    playButton: {top: 6, left: 6},
    /** The reveal handle shown once the box is tucked against a screen edge. */
    peekArrow: {
        position: "absolute",
        top: "50%",
        width: 22,
        height: 40,
        marginTop: -20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(5,5,7,0.72)",
    },
    /** Box tucked at the right edge: the visible sliver is its left side. */
    peekArrowLeftEdge: {
        left: 0,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 10,
    },
    /** Box tucked at the left edge: the visible sliver is its right side. */
    peekArrowRightEdge: {
        right: 0,
        borderTopLeftRadius: 10,
        borderBottomLeftRadius: 10,
    },
});
