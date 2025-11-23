type ThemeType = "light" | "dark";

type ColorScheme = {
    background: string;
    text: string;
    accent: string;
    error: string;
    lightness: string;
    darkness: string;
};

const Colors: Record<ThemeType, ColorScheme> = {
    light: {
        background: "#FFFFFF",
        text: "#1e1e1e",
        accent: "#007AFF",
        error: "#d32f2f",
        lightness: "#E5E5EA",
        darkness: "#8A8A8E",
    },
    dark: {
        background: "#1C1C1E",
        text: "#f0f0f0",
        accent: "#0A84FF",
        error: "#ef5350",
        lightness: "#3A3A3C",
        darkness: "#2C2C2E",
    },
};

export const theme = (theme?: ThemeType): ColorScheme => {
    return Colors[theme || "light"];
};
