import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    View,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Chip} from "@/components/Chip/Chip";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {Icon} from "@/components/Icon/Icon";
import {SectionHeader} from "@/components/SectionHeader/SectionHeader";
import {StreakBadge} from "@/components/StreakBadge/StreakBadge";
import {Text} from "@/components/Text/Text";
import {VideoCard} from "@/components/VideoCard/VideoCard";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {ELEVATION, HIT_SLOP, PRESS, RADII, SPACE} from "@/constants/theme";
import {useNotifications} from "@/hooks/useNotification";
import {useStreak} from "@/hooks/useStreak";
import {
    clearHistoryAtom,
    favoriteItemsAtom,
    historyItemsAtom,
} from "@/stores/store";
import {useTheme} from "@/theme/colors";
import {formatRelativeTime} from "@/utils/format";
import {tapFeedback} from "@/utils/haptics";
import {isExpoGo} from "@/utils/notification";
import {shareStreak} from "@/utils/share";

const REMINDER_HOURS = [12, 15, 18, 19, 21, 22];

const Me = () => {
    const favorites = useAtomValue(favoriteItemsAtom);
    const history = useAtomValue(historyItemsAtom);
    const clearHistory = useSetAtom(clearHistoryAtom);
    const {streak, best, totalDays, nextMilestone} = useStreak();
    const notifications = useNotifications();
    const colors = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const openVideo = (id: string) => router.push(PATHS.VIDEO(id));

    const confirmClear = () =>
        Alert.alert(COPY.me.historyClearTitle, COPY.me.historyClearBody, [
            {text: COPY.common.cancel, style: "cancel"},
            {
                text: COPY.me.historyClearConfirm,
                style: "destructive",
                onPress: () => clearHistory(),
            },
        ]);

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={{
                paddingTop: insets.top + SPACE.md,
                paddingBottom: insets.bottom + SPACE.huge,
            }}
        >
            <View style={styles.heading}>
                <Text variant="display">{COPY.me.title}</Text>
            </View>

            <StreakBadge
                variant="card"
                streak={streak}
                best={best}
                nextMilestone={nextMilestone}
            />

            <View style={styles.streakActions}>
                <Text variant="caption" tone="faint">
                    {COPY.me.streakTotal(totalDays)}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={COPY.me.streakShare}
                    hitSlop={HIT_SLOP}
                    onPress={() => {
                        tapFeedback();
                        shareStreak(streak);
                    }}
                    style={({pressed}) => [
                        styles.streakShare,
                        pressed && styles.pressed,
                    ]}
                >
                    <Icon name="share-variant" size={16} color={colors.hot} />
                    <Text variant="label" tone="hot">
                        {COPY.me.streakShare}
                    </Text>
                </Pressable>
            </View>

            <SectionHeader title={COPY.me.favorites} />
            {favorites.length === 0 ? (
                <EmptyState
                    icon="heart-broken-outline"
                    title={COPY.me.favoritesEmpty}
                    actionLabel={COPY.me.favoritesEmptyAction}
                    onAction={() => router.push(PATHS.HOME)}
                />
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.rail}
                >
                    {favorites.map((item) => (
                        <VideoCard
                            key={item.id}
                            item={item}
                            onPress={() => openVideo(item.id)}
                        />
                    ))}
                </ScrollView>
            )}

            <SectionHeader
                title={COPY.me.history}
                actionLabel={
                    history.length > 0 ? COPY.me.historyClear : undefined
                }
                onAction={history.length > 0 ? confirmClear : undefined}
            />
            {history.length === 0 ? (
                <EmptyState icon="history" title={COPY.me.historyEmpty} />
            ) : (
                <View
                    style={[
                        styles.historyCard,
                        ELEVATION.card,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    {history.slice(0, 15).map(({item, entry}, index) => (
                        <Pressable
                            key={item.id}
                            style={({pressed}) => [
                                styles.historyRow,
                                index > 0 && {
                                    borderTopWidth: StyleSheet.hairlineWidth,
                                    borderTopColor: colors.border,
                                },
                                pressed && styles.pressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Abrir ${item.title}`}
                            onPress={() => openVideo(item.id)}
                        >
                            <View style={styles.historyText}>
                                <Text variant="label" numberOfLines={1}>
                                    {item.title}
                                </Text>
                                <Text variant="caption" tone="faint">
                                    {formatRelativeTime(entry.watchedAt)}
                                </Text>
                            </View>
                            <Icon
                                name="chevron-right"
                                size={20}
                                color={colors.textFaint}
                            />
                        </Pressable>
                    ))}
                </View>
            )}

            <SectionHeader title={COPY.me.settings} />
            <View
                style={[
                    styles.settingsCard,
                    ELEVATION.card,
                    {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                    },
                ]}
            >
                <View style={styles.settingRow}>
                    <View style={styles.settingText}>
                        <Text variant="label">{COPY.me.settingsDaily}</Text>
                        <Text variant="caption" tone="muted">
                            {COPY.me.settingsDailyHint}
                        </Text>
                    </View>
                    <Switch
                        value={notifications.enabled}
                        onValueChange={(next) => {
                            tapFeedback();
                            if (next) notifications.enable();
                            else notifications.disable();
                        }}
                        trackColor={{
                            true: colors.accent,
                            false: colors.surfaceAlt,
                        }}
                        thumbColor={
                            notifications.enabled
                                ? colors.accentText
                                : colors.textMuted
                        }
                        ios_backgroundColor={colors.surfaceAlt}
                        accessibilityLabel={COPY.me.settingsDaily}
                    />
                </View>

                {notifications.enabled ? (
                    <View style={styles.hourPicker}>
                        <Text variant="caption" tone="muted">
                            {COPY.me.settingsHour}
                        </Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.hourRow}
                        >
                            {REMINDER_HOURS.map((hour) => (
                                <Chip
                                    key={hour}
                                    label={`${hour}:00`}
                                    selected={
                                        notifications.reminderHour === hour
                                    }
                                    onPress={() =>
                                        notifications.setReminderHour(hour)
                                    }
                                />
                            ))}
                        </ScrollView>
                    </View>
                ) : null}

                {isExpoGo ? (
                    <Text variant="micro" tone="faint">
                        {COPY.me.expoGoNote}
                    </Text>
                ) : null}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    heading: {paddingHorizontal: SPACE.md, marginBottom: SPACE.md},
    streakActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.sm,
        paddingHorizontal: SPACE.md,
        marginTop: SPACE.sm,
    },
    streakShare: {flexDirection: "row", alignItems: "center", gap: SPACE.xxs},
    pressed: {opacity: PRESS.opacity},
    rail: {paddingHorizontal: SPACE.md},
    historyCard: {
        marginHorizontal: SPACE.md,
        borderRadius: RADII.lg,
        borderWidth: 1,
        overflow: "hidden",
    },
    historyRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        paddingHorizontal: SPACE.sm,
        paddingVertical: SPACE.sm,
    },
    historyText: {flex: 1, gap: 2},
    settingsCard: {
        marginHorizontal: SPACE.md,
        borderRadius: RADII.lg,
        borderWidth: 1,
        padding: SPACE.md,
        gap: SPACE.sm,
    },
    settingRow: {flexDirection: "row", alignItems: "center", gap: SPACE.sm},
    settingText: {flex: 1, gap: 2},
    hourPicker: {gap: SPACE.xs},
    hourRow: {gap: SPACE.xs, alignItems: "center", paddingVertical: SPACE.xxs},
});

export default Me;
