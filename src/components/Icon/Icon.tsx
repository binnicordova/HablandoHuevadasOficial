import {MaterialCommunityIcons} from "@expo/vector-icons";
import type {ComponentProps} from "react";
import {useTheme} from "@/theme/colors";
import {FONT_SIZE} from "@/theme/fonts";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type IconProps = ComponentProps<typeof MaterialCommunityIcons>;

export const Icon = ({
    name,
    style,
    size,
    color,
    onPress,
    ...props
}: IconProps) => {
    const {text} = useTheme();

    return (
        <MaterialCommunityIcons
            name={name}
            style={style}
            size={size ?? FONT_SIZE[3]}
            color={color ?? text}
            onPress={onPress}
            testID={name}
            {...props}
        />
    );
};
