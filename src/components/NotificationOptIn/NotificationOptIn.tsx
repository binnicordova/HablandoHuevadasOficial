import {useEffect, useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {Button} from "@/components/Button/Button";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {ELEVATION, HIT_SLOP, RADII, SPACE} from "@/constants/theme";
import {track} from "@/services/analytics";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";

type NotificationOptInProps = {
    onAccept: () => Promise<boolean> | boolean;
    onDismiss: () => void;
};

/**
 * Inline card, not a modal. It sits inside the feed so it never blocks the core
 * action, and it is only mounted once the user has already watched something.
 */
export const NotificationOptIn = ({
    onAccept,
    onDismiss,
}: NotificationOptInProps) => {
    const colors = useTheme();
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        track({name: "notification_prompt_shown"});
    }, []);

    return (
        <View
            style={[
                styles.container,
                ELEVATION.card,
                {backgroundColor: colors.surface, borderColor: colors.border},
            ]}
        >
            <Pressable
                style={styles.close}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={COPY.common.close}
                onPress={() => {
                    tapFeedback();
                    onDismiss();
                }}
            >
                <Icon name="close" size={18} color={colors.textFaint} />
            </Pressable>

            <View style={styles.header}>
                <View
                    style={[
                        styles.iconWrap,
                        {backgroundColor: colors.surfaceAlt},
                    ]}
                >
                    <Icon
                        name="bell-ring-outline"
                        size={22}
                        color={colors.accent}
                    />
                </View>
                <Text variant="heading" style={styles.title}>
                    {COPY.notification.optInTitle}
                </Text>
            </View>

            <Text variant="body" tone="muted">
                {COPY.notification.optInBody}
            </Text>

            <View style={styles.actions}>
                <Button
                    title={COPY.notification.optInAccept}
                    loading={busy}
                    onPress={async () => {
                        setBusy(true);
                        try {
                            await onAccept();
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: SPACE.md,
        marginTop: SPACE.md,
        padding: SPACE.md,
        borderRadius: RADII.lg,
        borderWidth: 1,
        gap: SPACE.sm,
    },
    close: {position: "absolute", top: SPACE.sm, right: SPACE.sm, zIndex: 1},
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        paddingRight: SPACE.lg,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: RADII.sm,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {flex: 1},
    actions: {marginTop: SPACE.xxs},
});
