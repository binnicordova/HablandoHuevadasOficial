import {BlurView} from "expo-blur";
import {Tabs} from "expo-router";
import {type ColorValue, Platform, StyleSheet} from "react-native";
import {Icon, type IconName} from "@/components/Icon/Icon";
import {COPY} from "@/constants/copy";
import {BLUR, FONTS, SPACE} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

const tabIcon =
    (name: IconName, focusedName: IconName) =>
    ({
        color,
        focused,
        size,
    }: {
        color: ColorValue;
        focused: boolean;
        size: number;
    }) => (
        <Icon
            name={focused ? focusedName : name}
            size={size}
            color={color as string}
        />
    );

const TabsLayout = () => {
    const colors = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                sceneStyle: {backgroundColor: colors.background},
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.textFaint,
                // iOS gets a frosted bar over the content; Android takes a solid
                // raised fill, where the blur costs more than it delivers.
                tabBarBackground:
                    Platform.OS === "ios"
                        ? () => (
                              <BlurView
                                  intensity={BLUR.chrome}
                                  tint={BLUR.tint}
                                  style={StyleSheet.absoluteFill}
                              />
                          )
                        : undefined,
                tabBarStyle: {
                    position: Platform.OS === "ios" ? "absolute" : "relative",
                    backgroundColor:
                        Platform.OS === "ios"
                            ? "transparent"
                            : colors.backgroundRaised,
                    borderTopColor: colors.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    elevation: 0,
                },
                tabBarLabelStyle: {
                    fontFamily: FONTS.bold,
                    fontSize: 10,
                    letterSpacing: 0.2,
                },
                tabBarItemStyle: {paddingTop: SPACE.xxs},
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: COPY.tabs.home,
                    tabBarIcon: tabIcon("home-outline", "home"),
                }}
            />
            <Tabs.Screen
                name="shorts"
                options={{
                    title: COPY.tabs.shorts,
                    tabBarIcon: tabIcon("play-box-outline", "play-box"),
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: COPY.tabs.search,
                    tabBarIcon: tabIcon("magnify", "magnify"),
                }}
            />
            <Tabs.Screen
                name="favorites"
                options={{
                    title: COPY.tabs.favorites,
                    tabBarIcon: tabIcon("heart-outline", "heart"),
                }}
            />
            <Tabs.Screen
                name="me"
                options={{
                    title: COPY.tabs.me,
                    tabBarIcon: tabIcon("account-outline", "account"),
                }}
            />
        </Tabs>
    );
};

export default TabsLayout;
