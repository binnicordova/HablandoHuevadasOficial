import {ScrollView, StyleSheet, View} from "react-native";
import {Chip} from "@/components/Chip/Chip";
import {COPY} from "@/constants/copy";
import {SPACE} from "@/constants/theme";
import type {VideoKind} from "@/models/video";

export type KindFilterValue = VideoKind | "all";

export const KIND_FILTERS: {key: KindFilterValue; label: string}[] = [
    {key: "all", label: COPY.search.filters.all},
    {key: "video", label: COPY.search.filters.videos},
    {key: "short", label: COPY.search.filters.shorts},
];

type KindFilterProps = {
    value: KindFilterValue;
    onChange: (next: KindFilterValue) => void;
};

/** Todo / Episodios / Shorts. Shared by Buscar and Guardados. */
export const KindFilter = ({value, onChange}: KindFilterProps) => (
    // The wrapper stops the horizontal ScrollView from stretching its children
    // to the full remaining height of the screen.
    <View style={styles.row}>
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.content}
        >
            {KIND_FILTERS.map(({key, label}) => (
                <Chip
                    key={key}
                    label={label}
                    selected={value === key}
                    onPress={() => onChange(key)}
                />
            ))}
        </ScrollView>
    </View>
);

const styles = StyleSheet.create({
    row: {height: 40 + SPACE.lg, justifyContent: "center"},
    content: {
        paddingHorizontal: SPACE.md,
        gap: SPACE.xs,
        alignItems: "center",
    },
});
