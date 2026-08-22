import {Pressable, StyleSheet, TextInput, View} from "react-native";
import {Icon} from "@/components/Icon/Icon";
import {COPY} from "@/constants/copy";
import {HIT_SLOP, MIN_TOUCH, RADII, SPACE, TYPE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";
import {tapFeedback} from "@/utils/haptics";

type SearchBarProps = {
    value: string;
    onChangeText: (value: string) => void;
    onSubmit?: () => void;
    placeholder?: string;
    autoFocus?: boolean;
};

export const SearchBar = ({
    value,
    onChangeText,
    onSubmit,
    placeholder,
    autoFocus = false,
}: SearchBarProps) => {
    const colors = useTheme();

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                },
            ]}
        >
            <Icon name="magnify" size={20} color={colors.textFaint} />
            <TextInput
                style={[TYPE.body, styles.input, {color: colors.text}]}
                value={value}
                onChangeText={onChangeText}
                onSubmitEditing={onSubmit}
                placeholder={placeholder}
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.accent}
                autoFocus={autoFocus}
                autoCorrect={false}
                returnKeyType="search"
                keyboardAppearance="dark"
                accessibilityLabel={placeholder}
                clearButtonMode="never"
            />
            {value.length > 0 ? (
                <Pressable
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={COPY.search.clear}
                    onPress={() => {
                        tapFeedback();
                        onChangeText("");
                    }}
                >
                    <Icon
                        name="close-circle"
                        size={20}
                        color={colors.textFaint}
                    />
                </Pressable>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        borderRadius: RADII.md,
        borderWidth: 1,
        paddingHorizontal: SPACE.md,
        marginHorizontal: SPACE.md,
        height: MIN_TOUCH + 4,
    },
    input: {flex: 1, paddingVertical: 0},
});
