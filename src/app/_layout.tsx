import {useFonts} from "expo-font";
import {DarkTheme, Stack, type Theme, ThemeProvider} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {StatusBar} from "expo-status-bar";
import {Provider} from "jotai";
import {useEffect} from "react";
import {View} from "react-native";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {GlobalPlayerHost} from "@/components/VideoPlayer/GlobalPlayerHost";
import {PlayerUIProvider} from "@/components/VideoPlayer/PlayerUIProvider";
import {COLORS} from "@/constants/theme";
import {useEngagement} from "@/hooks/useEngagement";
import {
    useNotificationRouting,
    useNotifications,
} from "@/hooks/useNotification";
import {useStreak} from "@/hooks/useStreak";
import {styles} from "@/styles";
import {useTheme} from "@/theme/colors";

SplashScreen.preventAutoHideAsync().catch(() => {});

const FONT_SETTINGS = {
    LatoLight: require("../../assets/fonts/Lato-Light.ttf"),
    LatoRegular: require("../../assets/fonts/Lato-Regular.ttf"),
    LatoBold: require("../../assets/fonts/Lato-Bold.ttf"),
};

/**
 * Session-level side effects. Lives under the jotai Provider so it can touch
 * persisted state, and renders nothing.
 */
const SessionBootstrap = () => {
    useStreak();
    useEngagement();
    useNotificationRouting();
    /*
     * Re-arms the notification schedule once per launch. It lives here rather
     * than on Inicio because a cold start from a notification tap opens the
     * video screen, and the schedule has to roll forward however the app was
     * opened — not only when the home tab happens to mount.
     */
    useNotifications();
    return null;
};

/**
 * React Navigation paints the scene background behind every screen. Left on the
 * default light theme it shows through the transparent lists as grey, so the
 * navigator gets the app palette explicitly rather than only the screens.
 */
const NAV_THEME: Theme = {
    ...DarkTheme,
    dark: true,
    colors: {
        ...DarkTheme.colors,
        background: COLORS.background,
        card: COLORS.backgroundRaised,
        text: COLORS.text,
        border: COLORS.border,
        primary: COLORS.accent,
        notification: COLORS.hot,
    },
};

const RootNavigator = () => {
    const colors = useTheme();

    return (
        <View style={[styles.baseLayer, {backgroundColor: colors.background}]}>
            <StatusBar style="light" />
            <SessionBootstrap />
            <ThemeProvider value={NAV_THEME}>
                <PlayerUIProvider>
                    <Stack
                        screenOptions={{
                            headerShown: false,
                            contentStyle: {backgroundColor: colors.background},
                            animation: "slide_from_right",
                        }}
                    >
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="video/[id]" />
                        <Stack.Screen name="web" />
                    </Stack>
                    {/*
                     * The one video player instance for the whole app,
                     * painted above every screen so switching tabs or
                     * scrolling Inicio never tears it down. See
                     * GlobalPlayerHost for why.
                     */}
                    <GlobalPlayerHost />
                </PlayerUIProvider>
            </ThemeProvider>
        </View>
    );
};

const RootLayout = () => {
    const [fontsLoaded, fontError] = useFonts(FONT_SETTINGS);

    useEffect(() => {
        if (fontsLoaded || fontError) {
            SplashScreen.hideAsync().catch(() => {});
        }
    }, [fontsLoaded, fontError]);

    // Fonts failing to load must not leave the user on a blank splash forever.
    if (!fontsLoaded && !fontError) {
        return null;
    }

    return (
        <GestureHandlerRootView style={styles.baseLayer}>
            <SafeAreaProvider>
                <Provider>
                    <RootNavigator />
                </Provider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
};

let AppEntryPoint = RootLayout;

if (process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === "true") {
    try {
        AppEntryPoint = require("../../.rnstorybook").default;
        SplashScreen.hideAsync().catch(() => {});
    } catch (error) {
        console.warn("Storybook not available:", error);
    }
}

export default AppEntryPoint;
