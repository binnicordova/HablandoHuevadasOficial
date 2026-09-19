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
};

export const FloatingActionButton = ({
    onPress,
    icon = "shuffle-variant",
    label = COPY.home.shuffle,
    bottom,
}: FloatingActionButtonProps) => {
    const colors = useTheme();

    return (
        <Pressable
            style={({pressed}) => [
                styles.container,
                ELEVATION.glow,
                {backgroundColor: colors.accent},
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
            <Icon name={icon} size={26} color={colors.accentText} />
        </Pressable>
    );
};
