import {LinearGradient} from "expo-linear-gradient";
import type React from "react";
import type {StyleProp, ViewStyle} from "react-native";
import {createShimmerPlaceholder} from "react-native-shimmer-placeholder";
import {useTheme} from "@/theme/colors";
import {styles} from "./Placeholder.styles";

const ShimmerPlaceholder = createShimmerPlaceholder(LinearGradient);

interface PlaceholderProps {
    style?: StyleProp<ViewStyle>;
    visible?: boolean;
    children?: React.ReactNode;
    width?: number;
    height?: number;
}

export const Placeholder: React.FC<PlaceholderProps> = ({
    style,
    visible = false,
    children,
    width,
    height,
}) => {
    const {shimmerFrom, shimmerTo} = useTheme();

    return (
        <ShimmerPlaceholder
            style={[styles.container, style]}
            visible={visible}
            width={width}
            height={height}
            shimmerColors={[shimmerFrom, shimmerTo, shimmerFrom]}
        >
            {children}
        </ShimmerPlaceholder>
    );
};
