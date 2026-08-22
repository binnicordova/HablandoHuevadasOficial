import {useCallback} from "react";
import {ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Button} from "@/components/Button/Button";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {SoundPad} from "@/components/SoundPad/SoundPad";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {SOUNDBOARD, type SoundPadSpec} from "@/constants/soundboard";
import {SPACE} from "@/constants/theme";
import {useSoundboard} from "@/hooks/useSoundboard";

const COLUMNS = 2;

const Soundboard = () => {
    const insets = useSafeAreaInsets();
    const {play, stopAll, activeId, failedId} = useSoundboard();

    const handlePress = useCallback(
        (spec: SoundPadSpec) => {
            play(spec.id, spec.source);
        },
        [play]
    );

    // A plain wrapped grid: nine pads never need virtualising, and a ScrollView
    // keeps every pad measurable for the press animation.
    const rows: SoundPadSpec[][] = [];
    for (let i = 0; i < SOUNDBOARD.length; i += COLUMNS) {
        rows.push(SOUNDBOARD.slice(i, i + COLUMNS));
    }

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={{
                paddingTop: insets.top + SPACE.md,
                paddingBottom: insets.bottom + SPACE.xxl,
            }}
        >
            <View style={styles.header}>
                <Text variant="display">{COPY.soundboard.title}</Text>
                <Text variant="body" tone="muted">
                    {COPY.soundboard.subtitle}
                </Text>
            </View>

            {SOUNDBOARD.length === 0 ? (
                <EmptyState
                    icon="music-note-off-outline"
                    title={COPY.soundboard.empty}
                />
            ) : (
                <View style={styles.grid}>
                    {rows.map((row) => (
                        <View
                            key={row.map((pad) => pad.id).join("-")}
                            style={styles.row}
                        >
                            {row.map((spec) => (
                                <SoundPad
                                    key={spec.id}
                                    spec={spec}
                                    active={activeId === spec.id}
                                    failed={failedId === spec.id}
                                    onPress={handlePress}
                                />
                            ))}
                            {row.length < COLUMNS ? (
                                <View style={styles.spacer} />
                            ) : null}
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.footer}>
                <Text variant="caption" tone="faint" style={styles.hint}>
                    {COPY.soundboard.tapHint}
                </Text>
                <Button
                    title={COPY.soundboard.stopAll}
                    variant="secondary"
                    icon="stop"
                    onPress={stopAll}
                    fullWidth={false}
                />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    header: {
        paddingHorizontal: SPACE.md,
        gap: SPACE.xxs,
        marginBottom: SPACE.lg,
    },
    grid: {paddingHorizontal: SPACE.md, gap: SPACE.sm},
    row: {flexDirection: "row", gap: SPACE.sm},
    spacer: {flex: 1},
    footer: {
        paddingHorizontal: SPACE.md,
        paddingTop: SPACE.xl,
        alignItems: "center",
        gap: SPACE.sm,
    },
    hint: {textAlign: "center"},
});

export default Soundboard;
