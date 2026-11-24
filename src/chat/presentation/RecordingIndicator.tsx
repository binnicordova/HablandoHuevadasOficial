import {useEffect, useRef} from "react";
import {Animated, StyleSheet, View} from "react-native";

import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

/** "<Personaje> está grabando un audio…" with a pulsing mic. */
export const RecordingIndicator = ({name}: {name: string}) => {
    const colors = useTheme();
    const pulse = useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0.35,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return (
        <View style={styles.row} accessibilityLiveRegion="polite">
            <Animated.View style={{opacity: pulse}}>
                <Icon name="microphone" size={18} color={colors.hot} />
            </Animated.View>
            <Text variant="caption" tone="muted">
                {COPY.chat.recording(name)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        paddingLeft: SPACE.xs,
    },
});
