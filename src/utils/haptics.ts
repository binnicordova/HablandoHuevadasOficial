import * as Haptics from "expo-haptics";
import {Platform} from "react-native";

const isSupported = Platform.OS === "ios" || Platform.OS === "android";

/** Fire-and-forget haptics. Never throws, never blocks a tap handler. */
export const tapFeedback = () => {
    if (!isSupported) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export const successFeedback = () => {
    if (!isSupported) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
    );
};

export const selectionFeedback = () => {
    if (!isSupported) return;
    Haptics.selectionAsync().catch(() => {});
};
