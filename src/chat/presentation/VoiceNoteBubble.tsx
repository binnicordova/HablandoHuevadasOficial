import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import type {ChatMessage} from "@/chat/domain/message";
import {formatDuration} from "@/chat/presentation/format";
import {voiceTint} from "@/chat/presentation/voiceTint";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {HIT_SLOP, MIN_TOUCH, RADII, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";

type Props = {
    message: ChatMessage;
    active: boolean;
    playing: boolean;
    progress: number;
    onToggle: (message: ChatMessage) => void;
    onReport: (message: ChatMessage) => void;
};

export const VoiceNoteBubble = ({
    message,
    active,
    playing,
    progress,
    onToggle,
    onReport,
}: Props) => {
    const colors = useTheme();
    const [showText, setShowText] = useState(false);
    const tint = voiceTint(message.speaker, colors);
    const name =
        message.name ??
        message.speaker.charAt(0).toUpperCase() + message.speaker.slice(1);

    return (
        <View style={styles.row}>
            <View style={[styles.avatar, {backgroundColor: tint}]}>
                <Text variant="label" style={{color: colors.accentText}}>
                    {name[0]}
                </Text>
            </View>
            <Pressable
                onLongPress={() => onReport(message)}
                delayLongPress={450}
                accessibilityHint={COPY.chat.report}
                style={[
                    styles.bubble,
                    {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Text variant="micro" style={{color: tint}} uppercase>
                    {name}
                </Text>
                <View style={styles.player}>
                    <Pressable
                        onPress={() => {
                            tapFeedback();
                            onToggle(message);
                        }}
                        hitSlop={HIT_SLOP}
                        accessibilityRole="button"
                        accessibilityLabel={`${active && playing ? COPY.chat.pause : COPY.chat.play}, ${name}`}
                        style={[styles.playButton, {backgroundColor: tint}]}
                    >
                        <Icon
                            name={active && playing ? "pause" : "play"}
                            size={22}
                            color={colors.accentText}
                        />
                    </Pressable>
                    <View style={styles.track}>
                        <View
                            style={[
                                styles.trackBase,
                                {backgroundColor: colors.borderStrong},
                            ]}
                        >
                            <View
                                style={[
                                    styles.trackFill,
                                    {
                                        backgroundColor: tint,
                                        width: `${(active ? progress : 0) * 100}%`,
                                    },
                                ]}
                            />
                        </View>
                        <Text variant="caption" tone="muted">
                            {formatDuration(message.durationMs)}
                        </Text>
                    </View>
                </View>
                <Pressable
                    onPress={() => setShowText((v) => !v)}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityState={{expanded: showText}}
                >
                    <Text variant="caption" tone="faint">
                        {showText ? COPY.chat.hideText : COPY.chat.showText}
                    </Text>
                </Pressable>
                {showText ? (
                    <Text variant="body" style={styles.transcript}>
                        {message.text}
                    </Text>
                ) : null}
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: SPACE.xs,
        paddingRight: SPACE.xxl,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: RADII.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    bubble: {
        flexShrink: 1,
        minWidth: 220,
        gap: SPACE.xxs,
        paddingHorizontal: SPACE.sm,
        paddingVertical: SPACE.xs,
        borderRadius: RADII.md,
        borderBottomLeftRadius: RADII.xs,
        borderWidth: 1,
    },
    player: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.sm,
        minHeight: MIN_TOUCH,
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: RADII.pill,
        alignItems: "center",
        justifyContent: "center",
    },
    track: {flex: 1, gap: SPACE.xxs},
    trackBase: {height: 4, borderRadius: RADII.pill, overflow: "hidden"},
    trackFill: {height: 4, borderRadius: RADII.pill},
    transcript: {paddingTop: SPACE.xxs},
});
