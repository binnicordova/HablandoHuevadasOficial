import {useLocalSearchParams} from "expo-router";
import {useMemo} from "react";
import {ActivityIndicator, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {WebView} from "react-native-webview";
import {AppBar} from "@/components/AppBar/AppBar";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {COPY} from "@/constants/copy";
import {ABSOLUTE_FILL} from "@/styles";
import {useTheme} from "@/theme/colors";

/**
 * In-app browser used by notification deep links. Only https URLs are rendered:
 * a notification payload is untrusted input and must not be able to open
 * arbitrary schemes.
 */
const Web = () => {
    const {uri, title} = useLocalSearchParams<{uri?: string; title?: string}>();
    const insets = useSafeAreaInsets();
    const colors = useTheme();

    const safeUri = useMemo(() => {
        if (!uri) return null;
        try {
            const parsed = new URL(decodeURIComponent(uri));
            return parsed.protocol === "https:" ? parsed.toString() : null;
        } catch {
            return null;
        }
    }, [uri]);

    return (
        <View style={[styles.screen, {paddingTop: insets.top}]}>
            <AppBar title={title ? decodeURIComponent(title) : COPY.appName} />
            {safeUri ? (
                <WebView
                    source={{uri: safeUri}}
                    style={styles.webview}
                    startInLoadingState
                    renderLoading={() => (
                        <View style={styles.loading}>
                            <ActivityIndicator color={colors.accent} />
                        </View>
                    )}
                />
            ) : (
                <EmptyState icon="link-off" title={COPY.error.invalidUrl} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    webview: {flex: 1},
    loading: {...ABSOLUTE_FILL, alignItems: "center", justifyContent: "center"},
});

export default Web;
