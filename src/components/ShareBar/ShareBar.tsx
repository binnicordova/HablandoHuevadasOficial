import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {FavoriteButton} from "@/components/FavoriteButton/FavoriteButton";
import {Icon, type IconName} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {HIT_SLOP, PRESS, RADII, SPACE} from "@/constants/theme";
import type {CatalogItem} from "@/models/video";
import {track} from "@/services/analytics";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";
import {
    copyLink,
    type ShareSource,
    shareToWhatsApp,
    shareVideo,
} from "@/utils/share";

type ShareBarProps = {
    item: CatalogItem;
    source?: ShareSource;
    onShared?: () => void;
    layout?: "row" | "column";
    tint?: string;
};

type Action = {
    key: string;
    icon: IconName;
    label: string;
    /** Used by the vertical rail, where horizontal room is tight. */
    shortLabel: string;
    /** Announced by screen readers — literal, not a punchline. */
    a11y: string;
    run: () => Promise<boolean>;
};

/**
 * The share loop. WhatsApp gets its own button because it is the default
 * sharing channel in LatAm and one tap fewer measurably lifts share rate.
 */
export const ShareBar = ({
    item,
    source = "player",
    onShared,
    layout = "row",
    tint,
}: ShareBarProps) => {
    const colors = useTheme();
    const [copied, setCopied] = useState(false);
    const iconColor = tint ?? colors.textMuted;

    const actions: Action[] = [
        {
            key: "whatsapp",
            icon: "whatsapp",
            label: COPY.share.whatsapp,
            shortLabel: COPY.share.shortLabels.whatsapp,
            a11y: COPY.share.whatsappLong,
            run: () => shareToWhatsApp(item, source),
        },
        {
            key: "share",
            icon: "share-variant",
            label: COPY.share.action,
            shortLabel: COPY.share.shortLabels.share,
            a11y: COPY.share.sheetTitle,
            run: () => shareVideo(item, source),
        },
        {
            key: "copy",
            icon: copied ? "check-bold" : "link-variant",
            label: copied ? COPY.share.copied : COPY.share.copy,
            shortLabel: copied
                ? COPY.share.shortLabels.copied
                : COPY.share.shortLabels.copy,
            a11y: COPY.share.copy,
            run: async () => {
                const ok = await copyLink(item, source);
                if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                }
                return ok;
            },
        },
    ];

    const isColumn = layout === "column";

    return (
        <View style={isColumn ? styles.column : styles.row}>
            <View style={isColumn ? styles.columnItem : styles.rowItem}>
                <FavoriteButton
                    id={item.id}
                    color={iconColor}
                    size={isColumn ? 28 : 22}
                />
                {isColumn ? (
                    <Text
                        variant="micro"
                        tone="muted"
                        style={styles.columnLabel}
                    >
                        {COPY.share.shortLabels.favorite}
                    </Text>
                ) : null}
            </View>

            {actions.map((action) => (
                <Pressable
                    key={action.key}
                    hitSlop={HIT_SLOP}
                    style={({pressed}) => [
                        isColumn ? styles.columnItem : styles.rowItem,
                        pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={action.a11y}
                    onPress={async () => {
                        tapFeedback();
                        const shared = await action.run();
                        if (shared) {
                            track({
                                name: "share",
                                videoId: item.id,
                                channel: action.key,
                                surface: source,
                            });
                            onShared?.();
                        }
                    }}
                >
                    <Icon
                        name={action.icon}
                        size={isColumn ? 28 : 22}
                        color={
                            action.key === "copy" && copied
                                ? colors.accent
                                : iconColor
                        }
                    />
                    {isColumn ? (
                        <Text
                            variant="micro"
                            tone="muted"
                            style={styles.columnLabel}
                        >
                            {action.label}
                        </Text>
                    ) : null}
                </Pressable>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {flexDirection: "row", alignItems: "center", gap: SPACE.md},
    rowItem: {
        alignItems: "center",
        justifyContent: "center",
        minWidth: 32,
        minHeight: 32,
    },
    column: {flexDirection: "column", alignItems: "center", gap: SPACE.md},
    columnItem: {
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        width: 64,
        paddingVertical: SPACE.xxs,
        borderRadius: RADII.md,
    },
    columnLabel: {
        textAlign: "center",
        // The rail floats over video, so the label needs its own contrast.
        textShadowColor: "rgba(0, 0, 0, 0.9)",
        textShadowOffset: {width: 0, height: 1},
        textShadowRadius: 4,
    },
    pressed: {opacity: PRESS.opacity, transform: [{scale: 0.92}]},
});
