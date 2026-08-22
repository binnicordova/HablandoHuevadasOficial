import {BlurView} from "expo-blur";
import type {ReactNode} from "react";
import {
    Platform,
    type StyleProp,
    StyleSheet,
    View,
    type ViewStyle,
} from "react-native";
import {BLUR, RADII} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

type GlassSurfaceProps = {
    children: ReactNode;
    intensity?: number;
    radius?: number;
    style?: StyleProp<ViewStyle>;
    /** Adds the 1px light hairline that makes glass read as a raised sheet. */
    bordered?: boolean;
};

/**
 * Frosted panel. Android's blur is cheaper and less convincing, so there it
 * falls back to a solid raised fill rather than a washed-out smear.
 */
export const GlassSurface = ({
    children,
    intensity = BLUR.chrome,
    radius = RADII.lg,
    style,
    bordered = true,
}: GlassSurfaceProps) => {
    const colors = useTheme();

    const frame: StyleProp<ViewStyle> = [
        styles.frame,
        {borderRadius: radius},
        bordered && {borderWidth: 1, borderColor: colors.border},
        style,
    ];

    if (Platform.OS === "android") {
        return (
            <View style={[frame, {backgroundColor: colors.backgroundRaised}]}>
                {children}
            </View>
        );
    }

    return (
        <BlurView intensity={intensity} tint={BLUR.tint} style={frame}>
            <View
                style={[
                    StyleSheet.absoluteFill,
                    {backgroundColor: colors.glass},
                ]}
            />
            {children}
        </BlurView>
    );
};

const styles = StyleSheet.create({
    frame: {overflow: "hidden"},
});
