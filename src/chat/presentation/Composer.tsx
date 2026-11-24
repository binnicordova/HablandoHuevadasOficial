import {useState} from "react";
import {Pressable, StyleSheet, TextInput, View} from "react-native";
import {canSend, MAX_MESSAGE_CHARS} from "@/chat/domain/message";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {MIN_TOUCH, RADII, SPACE, TYPE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";

const COUNTER_FROM = 40;

type Props = {
    busy: boolean;
    onSend: (draft: string) => boolean;
};

export const Composer = ({busy, onSend}: Props) => {
    const colors = useTheme();
    const [draft, setDraft] = useState("");
    const left = MAX_MESSAGE_CHARS - draft.length;
    const enabled = canSend(draft) && !busy;

    const submit = () => {
        if (!enabled) return;
        tapFeedback();
        if (onSend(draft)) setDraft("");
    };

    return (
        <View style={styles.row}>
            <View
                style={[
                    styles.field,
                    {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                    },
                ]}
            >
                <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={COPY.chat.placeholder}
                    placeholderTextColor={colors.textFaint}
                    multiline
                    maxLength={MAX_MESSAGE_CHARS + 40}
                    style={[styles.input, {color: colors.text}]}
                    accessibilityLabel={COPY.chat.placeholder}
                    returnKeyType="default"
                />
                {left <= COUNTER_FROM ? (
                    <Text variant="micro" tone={left < 0 ? "error" : "faint"}>
                        {COPY.chat.counter(left)}
                    </Text>
                ) : null}
            </View>
            <Pressable
                onPress={submit}
                disabled={!enabled}
                accessibilityRole="button"
                accessibilityLabel={COPY.chat.send}
                accessibilityState={{disabled: !enabled}}
                style={[
                    styles.send,
                    {
                        backgroundColor: enabled
                            ? colors.accent
                            : colors.surfaceAlt,
                    },
                ]}
            >
                <Icon
                    name="send"
                    size={20}
                    color={enabled ? colors.accentText : colors.textFaint}
                />
            </Pressable>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: SPACE.xs,
        paddingHorizontal: SPACE.md,
        paddingTop: SPACE.xs,
    },
    field: {
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: SPACE.xs,
        minHeight: MIN_TOUCH,
        maxHeight: 120,
        paddingHorizontal: SPACE.sm,
        borderRadius: RADII.xl,
        borderWidth: 1,
    },
    input: {
        ...TYPE.body,
        flex: 1,
        paddingTop: SPACE.sm,
        paddingBottom: SPACE.sm,
    },
    send: {
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: RADII.pill,
        alignItems: "center",
        justifyContent: "center",
    },
});
