import {Pressable} from "react-native";
import {Icon, type IconName} from "@/components/Icon/Icon";
import {COPY} from "@/constants/copy";
import {ELEVATION} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";
import {styles} from "./FloatingActionButton.styles";

type FloatingActionButtonProps = {
    onPress: () => void;
    icon?: IconName;
    label?: string;
    bottom?: number;
    /** Fill colour, so a second stacked FAB can read as its own action
     *  instead of a duplicate of the first. Defaults to the usual accent. */
    tint?: string;
    tintText?: string;
};

export const FloatingActionButton = ({
    onPress,
    icon = "shuffle-variant",
    label = COPY.home.shuffle,
    bottom,
    tint,
    tintText,
}: FloatingActionButtonProps) => {
    const colors = useTheme();

    return (
        <Pressable
            style={({pressed}) => [
                styles.container,
                ELEVATION.glow,
                {backgroundColor: tint ?? colors.accent},
                bottom !== undefined && {bottom},
                pressed && styles.pressed,
            ]}
            onPress={() => {
                tapFeedback();
                onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <Icon name={icon} size={26} color={tintText ?? colors.accentText} />
        </Pressable>
    );
};
