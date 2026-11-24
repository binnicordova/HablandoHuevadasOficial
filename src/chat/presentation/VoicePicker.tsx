import {ScrollView, StyleSheet, View} from "react-native";
import type {VoiceProfile} from "@/chat/domain/voice";
import {Chip} from "@/components/Chip/Chip";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {SPACE} from "@/constants/theme";

type Props = {
    voices: VoiceProfile[];
    selectedIds: string[];
    onToggle: (id: string) => void;
};

/** "Con quién hablas": pick the personajes who answer. */
export const VoicePicker = ({voices, selectedIds, onToggle}: Props) => {
    if (voices.length === 0) return null;
    return (
        <View style={styles.wrap}>
            <Text variant="micro" tone="faint" uppercase style={styles.label}>
                {COPY.chat.pickerLabel}
            </Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
            >
                {voices.map((voice) => (
                    <Chip
                        key={voice.id}
                        label={voice.displayName}
                        selected={selectedIds.includes(voice.id)}
                        onPress={() => onToggle(voice.id)}
                    />
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {gap: SPACE.xxs, paddingTop: SPACE.xs},
    label: {paddingHorizontal: SPACE.md},
    row: {gap: SPACE.xs, paddingHorizontal: SPACE.md},
});
