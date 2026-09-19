import type React from "react";
import {useState} from "react";
import {Modal, Pressable, Share, StyleSheet, View} from "react-native";
import {Button} from "@/components/Button/Button";
import {GlassSurface} from "@/components/GlassSurface/GlassSurface";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {HIT_SLOP, RADII, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {successFeedback, tapFeedback} from "@/utils/haptics";
import {storeUrl} from "@/utils/share";

interface PromoModalProps {
    visible: boolean;
    onClose: () => void;
    onShared?: () => void;
}

const shareMessage = `🎉 ${COPY.promo.body}\n\n${storeUrl("promo")}\n\n#HablandoHuevadas`;

/**
 * Community share prompt. Visibility is decided by the caller through the
 * engagement counters, so it can never appear on a first launch or more than
 * once a week.
 */
const PromoModal: React.FC<PromoModalProps> = ({
    visible,
    onClose,
    onShared,
}) => {
    const [isSharing, setIsSharing] = useState(false);
    const colors = useTheme();

    const handleShare = async () => {
        try {
            setIsSharing(true);
            const result = await Share.share({message: shareMessage});
            if (result.action === Share.sharedAction) {
                successFeedback();
                onShared?.();
            }
            onClose();
        } catch {
            onClose();
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable
                style={[styles.overlay, {backgroundColor: colors.overlay}]}
                onPress={onClose}
            >
                <Pressable
                    onPress={(event) => event.stopPropagation()}
                    style={styles.sheetWrap}
                >
                    <GlassSurface radius={RADII.xxl} style={styles.sheet}>
                        <Pressable
                            style={[
                                styles.close,
                                {backgroundColor: colors.surfaceAlt},
                            ]}
                            onPress={() => {
                                tapFeedback();
                                onClose();
                            }}
                            hitSlop={HIT_SLOP}
                            accessibilityRole="button"
                            accessibilityLabel={COPY.common.close}
                        >
                            <Icon name="close" size={18} color={colors.text} />
                        </Pressable>

                        <View
                            style={[
                                styles.badge,
                                {backgroundColor: colors.surfaceAlt},
                            ]}
                        >
                            <Text variant="micro" tone="accent">
                                {COPY.promo.badge}
                            </Text>
                        </View>

                        <Text variant="title" style={styles.centered}>
                            {COPY.promo.title}
                        </Text>
                        <Text
                            variant="body"
                            tone="muted"
                            style={styles.centered}
                        >
                            {COPY.promo.body}
                        </Text>

                        <View
                            style={[
                                styles.bullets,
                                {borderColor: colors.border},
                            ]}
                        >
                            {COPY.promo.bullets.map((bullet) => (
                                <View key={bullet} style={styles.bulletRow}>
                                    <Icon
                                        name="check-bold"
                                        size={16}
                                        color={colors.accent}
                                    />
                                    <Text
                                        variant="body"
                                        style={styles.bulletText}
                                    >
                                        {bullet}
                                    </Text>
                                </View>
                            ))}
                        </View>

                        <Button
                            title={COPY.promo.cta}
                            icon="share-variant"
                            loading={isSharing}
                            onPress={handleShare}
                        />
                        <Button
                            title={COPY.promo.dismiss}
                            variant="ghost"
                            onPress={onClose}
                        />

                        <Text
                            variant="micro"
                            tone="faint"
                            style={styles.centered}
                        >
                            {COPY.promo.legal}
                        </Text>
                    </GlassSurface>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: SPACE.md,
    },
    sheetWrap: {width: "100%", maxWidth: 420},
    sheet: {padding: SPACE.lg, gap: SPACE.sm},
    close: {
        position: "absolute",
        top: SPACE.sm,
        right: SPACE.sm,
        width: 36,
        height: 36,
        borderRadius: RADII.pill,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    badge: {
        alignSelf: "center",
        paddingVertical: 6,
        paddingHorizontal: SPACE.sm,
        borderRadius: RADII.pill,
        marginBottom: SPACE.xxs,
    },
    centered: {textAlign: "center"},
    bullets: {
        borderWidth: 1,
        borderRadius: RADII.md,
        padding: SPACE.sm,
        gap: SPACE.xs,
        marginVertical: SPACE.xs,
    },
    bulletRow: {flexDirection: "row", alignItems: "center", gap: SPACE.xs},
    bulletText: {flex: 1},
});

export default PromoModal;
