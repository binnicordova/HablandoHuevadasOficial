import {StyleSheet, View} from "react-native";
import {Button} from "@/components/Button/Button";
import {Icon, type IconName} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {RADII, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

type EmptyStateProps = {
    icon?: IconName;
    title: string;
    message?: string;
    actionLabel?: string;
    onAction?: () => void;
};

export const EmptyState = ({
    icon = "emoticon-dead-outline",
    title,
    message,
    actionLabel,
    onAction,
}: EmptyStateProps) => {
    const colors = useTheme();

    return (
        <View style={styles.container}>
            <View
                style={[
                    styles.iconWrap,
                    {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Icon name={icon} size={28} color={colors.textFaint} />
            </View>
            <Text variant="heading" style={styles.centered}>
                {title}
            </Text>
            {message ? (
                <Text variant="body" tone="muted" style={styles.centered}>
                    {message}
                </Text>
            ) : null}
            {actionLabel && onAction ? (
                <View style={styles.action}>
                    <Button
                        title={actionLabel}
                        onPress={onAction}
                        fullWidth={false}
                    />
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.sm,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.xxl,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: RADII.xl,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: SPACE.xs,
    },
    centered: {textAlign: "center"},
    action: {marginTop: SPACE.md},
});
