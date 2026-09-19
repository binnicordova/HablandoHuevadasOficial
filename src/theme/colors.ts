import {COLORS, PALETTE} from "@/constants/theme";

/**
 * The app ships a single premium dark theme. `useTheme()` stays a hook so
 * call sites do not change if a second theme is ever added, but it no longer
 * reads the system colour scheme — there is nothing to switch to.
 */
export type ColorScheme = typeof COLORS & {
    lightness: string;
    darkness: string;
};

const SCHEME: ColorScheme = {
    ...COLORS,
    // Legacy aliases kept so older call sites keep compiling.
    lightness: COLORS.surfaceAlt,
    darkness: COLORS.sunken,
};

/** Non-hook accessor for code that runs outside React (tasks, channels). */
export const theme = (): ColorScheme => SCHEME;

export const useTheme = (): ColorScheme => SCHEME;

export {PALETTE};
