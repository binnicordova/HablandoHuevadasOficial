import {Pressable, StyleSheet, View} from "react-native";
import type {ChatMessage} from "@/chat/domain/message";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {RADII, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

type Props = {
    message: ChatMessage;
    onRetry: (id: string) => void;
};

export const UserBubble = ({message, onRetry}: Props) => {
    const colors = useTheme();
    const failed = message.delivery === "failed";

    return (
        <View style={styles.row}>
            <View
                style={[
                    styles.bubble,
                    {backgroundColor: colors.accent},
                    failed && {opacity: 0.6},
                ]}
            >
                <Text variant="body" style={{color: colors.accentText}}>
                    {message.text}
                </Text>
            </View>
            {failed ? (
                <Pressable
                    onPress={() => onRetry(message.id)}
                    accessibilityRole="button"
                >
                    <Text variant="caption" tone="error">
                        {COPY.chat.retry}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {alignItems: "flex-end", gap: SPACE.xxs, paddingLeft: SPACE.xxl},
    bubble: {
        paddingHorizontal: SPACE.sm,
        paddingVertical: SPACE.xs,
        borderRadius: RADII.md,
        borderBottomRightRadius: RADII.xs,
    },
});
