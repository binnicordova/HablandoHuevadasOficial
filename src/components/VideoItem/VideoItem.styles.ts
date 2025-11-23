import {StyleSheet} from "react-native";
import {theme} from "@/theme/colors";
import {SPACING} from "@/theme/spacing";

const colors = theme();

export const styles = StyleSheet.create({
    container: {
        flexDirection: "column",
        marginHorizontal: SPACING[3],
        marginVertical: SPACING[2],
        backgroundColor: colors.background,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.23,
        shadowRadius: 2.62,
        elevation: 4,
    },
    thumbnail: {
        width: "100%",
        aspectRatio: 16 / 9,
        borderRadius: 8,
        marginBottom: SPACING[2],
        resizeMode: "cover",
    },
    textContainer: {
        flex: 1,
        paddingHorizontal: SPACING[2],
    },
    infoContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: SPACING[1],
        opacity: 0.7,
    },
});
