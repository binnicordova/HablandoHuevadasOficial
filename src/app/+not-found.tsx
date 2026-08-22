import {useRouter} from "expo-router";
import {StyleSheet, View} from "react-native";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";

const NotFound = () => {
    const router = useRouter();

    return (
        <View style={styles.screen}>
            <EmptyState
                icon="compass-off-outline"
                title={COPY.error.notFoundTitle}
                message={COPY.error.notFoundBody}
                actionLabel={COPY.error.goHome}
                onAction={() => router.replace(PATHS.HOME)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1, justifyContent: "center"},
});

export default NotFound;
