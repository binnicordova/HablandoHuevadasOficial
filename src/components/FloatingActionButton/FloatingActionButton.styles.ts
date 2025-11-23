import {StyleSheet} from "react-native";
import {theme} from "@/theme/colors";

const colors = theme();

export const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 80,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.accent,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        overflow: "hidden",
    },
    icon: {
        width: "100%",
        height: "100%",
        zIndex: 999,
    },
});
