import {router, useNavigation} from "expo-router";
import {Pressable, View} from "react-native";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {HIT_SLOP, PRESS} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";
import {styles} from "./AppBar.styles";

type AppBarProps = {
    title?: string;
    actions?: () => React.ReactNode;
};

export const AppBar: React.FC<AppBarProps> = ({
    title,
    actions: appBarActions,
}) => {
    const navigation = useNavigation();
    const colors = useTheme();
    const canGoBack = navigation.canGoBack();

    const handleBackPress = () => {
        tapFeedback();
        if (router.canGoBack()) router.back();
    };

    return (
        <View style={styles.container}>
            {canGoBack && (
                <Pressable
                    onPress={handleBackPress}
                    accessibilityRole="button"
                    accessibilityLabel={COPY.common.back}
                    testID="back-button"
                    hitSlop={HIT_SLOP}
                    style={({pressed}) => [
                        styles.back,
                        {backgroundColor: colors.surfaceAlt},
                        pressed && {opacity: PRESS.opacity},
                    ]}
                >
                    <Icon name="chevron-left" size={24} color={colors.text} />
                </Pressable>
            )}
            <Text variant="heading" numberOfLines={1} style={styles.title}>
                {title}
            </Text>
            {appBarActions?.()}
        </View>
    );
};
