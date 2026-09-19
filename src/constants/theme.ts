/**
 * Design tokens — single source of truth for the app's visual language.
 *
 * The app commits to one premium dark theme. There is no light variant: the
 * brand is a late-night comedy podcast, and a half-designed light mode would
 * look worse than no light mode at all.
 */

/* ------------------------------------------------------------------ color */

export const PALETTE = {
    /** Page ground. Near-black with a violet bias so it never reads as grey. */
    void: "#0B0B0E",
    /** Raised sheets, headers, tab bar. */
    raised: "#12121A",
    /** Cards. */
    surface: "#16161F",
    /** Inputs, chips, pressed states. */
    surfaceAlt: "#1E1E2A",
    /** Behind media, always the darkest thing on screen. */
    sunken: "#050507",

    /** Primary accent. Electric lime — CTAs, active tabs, progress. */
    lime: "#D4FF00",
    limeDim: "#A8CC00",
    /** Secondary accent. Hot pink — favourites, streak, anything affectionate. */
    hot: "#FF0055",
    hotDim: "#CC0044",
    /** Tertiary. Cyan — informational only, never a CTA. */
    cyan: "#00E5FF",

    white: "#FFFFFF",
    /** Body copy on dark. */
    silver: "#A0A0B0",
    /** Captions, metadata. */
    slate: "#70707F",

    success: "#3DDC97",
    warning: "#FFB84D",
    danger: "#FF3B30",

    /** Ink that sits on top of a lime or white fill. */
    onAccent: "#0B0B0E",
} as const;

export const COLORS = {
    background: PALETTE.void,
    backgroundRaised: PALETTE.raised,
    surface: PALETTE.surface,
    surfaceAlt: PALETTE.surfaceAlt,
    sunken: PALETTE.sunken,

    text: PALETTE.white,
    textMuted: PALETTE.silver,
    textFaint: PALETTE.slate,

    accent: PALETTE.lime,
    accentDim: PALETTE.limeDim,
    accentText: PALETTE.onAccent,

    hot: PALETTE.hot,
    hotDim: PALETTE.hotDim,
    info: PALETTE.cyan,

    success: PALETTE.success,
    warning: PALETTE.warning,
    error: PALETTE.danger,

    /** Hairlines. Kept at 8% so borders read as light, not as boxes. */
    border: "rgba(255, 255, 255, 0.08)",
    borderStrong: "rgba(255, 255, 255, 0.16)",
    /** Glass fills, layered over blur. */
    glass: "rgba(255, 255, 255, 0.06)",
    glassStrong: "rgba(255, 255, 255, 0.10)",
    overlay: "rgba(5, 5, 7, 0.82)",
    scrim: "rgba(5, 5, 7, 0.55)",

    shimmerFrom: "#16161F",
    shimmerTo: "#22222E",
} as const;

/* ---------------------------------------------------------------- spacing */

/**
 * 8pt grid. Odd indices are the 4pt half-steps, used only for optical nudges
 * (icon gaps, badge padding) — layout gutters always land on an even index.
 */
export const SPACE = {
    none: 0,
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
    xxxl: 56,
    huge: 72,
} as const;

export const RADII = {
    none: 0,
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    pill: 999,
} as const;

/** Every tappable element must clear this. */
export const HIT_SLOP = {top: 12, bottom: 12, left: 12, right: 12} as const;
export const MIN_TOUCH = 48;

/* ------------------------------------------------------------- typography */

export const FONTS = {
    light: "LatoLight",
    regular: "LatoRegular",
    bold: "LatoBold",
} as const;

export const TYPE = {
    display: {
        fontFamily: FONTS.bold,
        fontSize: 32,
        lineHeight: 36,
        letterSpacing: -0.8,
    },
    title: {
        fontFamily: FONTS.bold,
        fontSize: 24,
        lineHeight: 29,
        letterSpacing: -0.5,
    },
    heading: {
        fontFamily: FONTS.bold,
        fontSize: 19,
        lineHeight: 24,
        letterSpacing: -0.3,
    },
    subheading: {
        fontFamily: FONTS.bold,
        fontSize: 16,
        lineHeight: 21,
        letterSpacing: -0.2,
    },
    body: {
        fontFamily: FONTS.regular,
        fontSize: 15,
        lineHeight: 21,
        letterSpacing: 0,
    },
    label: {
        fontFamily: FONTS.bold,
        fontSize: 14,
        lineHeight: 19,
        letterSpacing: 0,
    },
    caption: {
        fontFamily: FONTS.regular,
        fontSize: 13,
        lineHeight: 17,
        letterSpacing: 0,
    },
    micro: {
        fontFamily: FONTS.bold,
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.8,
    },
} as const;

/* -------------------------------------------------------------- elevation */

export const ELEVATION = {
    card: {
        shadowColor: "#000000",
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: 0.45,
        shadowRadius: 20,
        elevation: 8,
    },
    floating: {
        shadowColor: "#000000",
        shadowOffset: {width: 0, height: 12},
        shadowOpacity: 0.55,
        shadowRadius: 28,
        elevation: 14,
    },
    /** Lime glow for the primary CTA and other accent surfaces. */
    glow: {
        shadowColor: PALETTE.lime,
        shadowOffset: {width: 0, height: 0},
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
    glowHot: {
        shadowColor: PALETTE.hot,
        shadowOffset: {width: 0, height: 0},
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 10,
    },
} as const;

export const BLUR = {
    /** expo-blur tint + intensity pairs, so glass reads the same everywhere. */
    tint: "dark" as const,
    chrome: 40,
    sheet: 60,
} as const;

/** Press feedback used across every interactive surface. */
export const PRESS = {
    opacity: 0.82,
    scale: 0.97,
} as const;

export const theme = {
    colors: COLORS,
    palette: PALETTE,
    space: SPACE,
    radii: RADII,
    type: TYPE,
    fonts: FONTS,
    elevation: ELEVATION,
    blur: BLUR,
    press: PRESS,
    hitSlop: HIT_SLOP,
    minTouch: MIN_TOUCH,
} as const;

export type Theme = typeof theme;
export type ThemeColors = typeof COLORS;
