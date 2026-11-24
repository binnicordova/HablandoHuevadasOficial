import type {ThemeColors} from "@/constants/theme";

/**
 * A stable accent per personaje, from its slug, so Jorge is always cyan and
 * the bubbles of a new voice need no code. Four tints, then they repeat.
 */
export const voiceTint = (slug: string, colors: ThemeColors): string => {
    const palette = [colors.info, colors.hot, colors.accent, colors.warning];
    let hash = 0;
    for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
};
