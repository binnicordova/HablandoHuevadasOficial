import {Text as RNText, type TextProps} from "react-native";
import {TYPE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

export type TextVariant =
    | "display"
    | "title"
    | "heading"
    | "subheading"
    | "body"
    | "label"
    | "caption"
    | "micro";

export type ThemedTextProps = TextProps & {
    variant?: TextVariant;
    /** Legacy prop kept so existing call sites keep rendering. */
    type?:
        | "default"
        | "title"
        | "subtitle"
        | "link"
        | "caption"
        | "error"
        | "label"
        | "muted";
    tone?:
        | "primary"
        | "muted"
        | "faint"
        | "accent"
        | "hot"
        | "error"
        | "inverse";
    uppercase?: boolean;
};

const LEGACY_VARIANT: Record<
    NonNullable<ThemedTextProps["type"]>,
    TextVariant
> = {
    default: "body",
    title: "title",
    subtitle: "heading",
    link: "body",
    caption: "caption",
    error: "body",
    label: "label",
    muted: "caption",
};

const LEGACY_TONE: Partial<
    Record<
        NonNullable<ThemedTextProps["type"]>,
        NonNullable<ThemedTextProps["tone"]>
    >
> = {
    caption: "muted",
    muted: "muted",
    error: "error",
    link: "accent",
};

export function Text({
    style,
    variant,
    type,
    tone,
    uppercase,
    ...rest
}: ThemedTextProps) {
    const colors = useTheme();
    const resolvedVariant = variant ?? (type ? LEGACY_VARIANT[type] : "body");
    const resolvedTone =
        tone ?? (type ? (LEGACY_TONE[type] ?? "primary") : "primary");

    const color = {
        primary: colors.text,
        muted: colors.textMuted,
        faint: colors.textFaint,
        accent: colors.accent,
        hot: colors.hot,
        error: colors.error,
        inverse: colors.accentText,
    }[resolvedTone];

    return (
        <RNText
            style={[
                TYPE[resolvedVariant],
                {color},
                uppercase && {textTransform: "uppercase"},
                type === "link" && {textDecorationLine: "underline"},
                style,
            ]}
            {...rest}
        />
    );
}
