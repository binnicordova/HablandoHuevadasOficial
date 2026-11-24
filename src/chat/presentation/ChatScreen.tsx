import {
    type RefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Alert,
    Dimensions,
    FlatList,
    Keyboard,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    View,
    type ViewInstance,
} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {type ChatMessage, isFromVoice} from "@/chat/domain/message";
import {Composer} from "@/chat/presentation/Composer";
import {RecordingIndicator} from "@/chat/presentation/RecordingIndicator";
import {UserBubble} from "@/chat/presentation/UserBubble";
import {useChat} from "@/chat/presentation/useChat";
import {usePlayback} from "@/chat/presentation/usePlayback";
import {VoiceNoteBubble} from "@/chat/presentation/VoiceNoteBubble";
import {VoicePicker} from "@/chat/presentation/VoicePicker";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {Icon} from "@/components/Icon/Icon";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {HIT_SLOP, RADII, SPACE, TAB_BAR_HEIGHT} from "@/constants/theme";
import {useTheme} from "@/theme/colors";

/**
 * Keyboard coordinates are in screen space, `measureInWindow` in window space.
 * They agree when the window runs under the status bar (a dev build, edge to
 * edge: screen and window are equally tall), but not in Expo Go, whose window
 * starts below the status bar. There the view looks one status bar higher than
 * it really is, and the composer ends up under the keyboard.
 * (Measured on a Galaxy A26 in Expo Go: window 750 dp, screen 832 dp, status
 * bar 34 dp, view bottom 700.8 dp, keyboard top 473.6 dp -> overlap 261 dp.)
 */
const windowTopOffset = (): number => {
    if (Platform.OS !== "android") return 0;
    const bars =
        Dimensions.get("screen").height - Dimensions.get("window").height;
    return bars > 0 ? (StatusBar.currentHeight ?? 0) : 0;
};

/**
 * How far the soft keyboard reaches up into `ref`'s view, in px (0 when it is
 * closed or does not touch the view).
 *
 * Measured, not assumed: KeyboardAvoidingView does nothing on edge-to-edge
 * Android, and the tab bar means the view does not end at the screen edge, so
 * the overlap is the view's bottom edge minus the keyboard's top edge.
 */
const useKeyboardOverlap = (ref: RefObject<ViewInstance | null>) => {
    const [overlap, setOverlap] = useState(0);
    const viewBottom = useRef(0);

    const measure = useCallback(() => {
        ref.current?.measureInWindow((_x, y, _w, height) => {
            viewBottom.current = y + height + windowTopOffset();
        });
    }, [ref]);

    useEffect(() => {
        const show = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            (e) => {
                setOverlap(
                    Math.max(0, viewBottom.current - e.endCoordinates.screenY)
                );
            }
        );
        const hide = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
            () => setOverlap(0)
        );
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    return {overlap, measure};
};

/**
 * Los patas: the group chat with Jorge and Ricardo.
 *
 * The user writes; the hosts answer with voice notes. Everything the hosts
 * say is generated, and the screen says so up front (see aiNotice) rather
 * than leaving it to the store listing.
 */
export const ChatScreen = () => {
    const colors = useTheme();
    const insets = useSafeAreaInsets();
    const screenRef = useRef<ViewInstance>(null);
    const {overlap, measure} = useKeyboardOverlap(screenRef);
    const chat = useChat();
    const playback = usePlayback(chat.messages);

    // Newest first: an inverted list keeps the latest message in view as
    // replies arrive, with no manual scrolling.
    const data = useMemo(() => [...chat.messages].reverse(), [chat.messages]);

    const confirmClear = useCallback(
        () =>
            Alert.alert(
                COPY.chat.clearConfirmTitle,
                COPY.chat.clearConfirmBody,
                [
                    {text: COPY.chat.cancel, style: "cancel"},
                    {
                        text: COPY.chat.clear,
                        style: "destructive",
                        onPress: () => {
                            chat.clear();
                        },
                    },
                ]
            ),
        [chat]
    );

    const confirmReport = useCallback(
        (message: ChatMessage) =>
            Alert.alert(COPY.chat.report, undefined, [
                {text: COPY.chat.cancel, style: "cancel"},
                {
                    text: COPY.chat.report,
                    onPress: async () => {
                        const ok = await chat.report(message);
                        Alert.alert(
                            ok ? COPY.chat.reportSent : COPY.chat.reportFailed
                        );
                    },
                },
            ]),
        [chat]
    );

    const openMenu = useCallback(
        () =>
            Alert.alert(COPY.chat.menu, undefined, [
                {text: COPY.chat.cancel, style: "cancel"},
                {
                    text: COPY.chat.clear,
                    style: "destructive",
                    onPress: confirmClear,
                },
            ]),
        [confirmClear]
    );

    const renderItem = useCallback(
        ({item}: {item: ChatMessage}) =>
            isFromVoice(item) ? (
                <VoiceNoteBubble
                    message={item}
                    active={playback.currentId === item.id}
                    playing={playback.playing}
                    progress={playback.progress}
                    onToggle={playback.toggle}
                    onReport={confirmReport}
                />
            ) : (
                <UserBubble message={item} onRetry={chat.retry} />
            ),
        [
            chat.retry,
            confirmReport,
            playback.currentId,
            playback.playing,
            playback.progress,
            playback.toggle,
        ]
    );

    // Closed: the iOS tab bar floats over the scene, so the composer clears it
    // itself (Android's bar is laid out normally). Open: sit on the keyboard.
    const composerBottom =
        overlap > 0
            ? overlap + SPACE.sm
            : Platform.OS === "ios"
              ? TAB_BAR_HEIGHT + insets.bottom
              : SPACE.sm;

    if (!chat.available) {
        return (
            <View
                style={[
                    styles.screen,
                    {
                        backgroundColor: colors.background,
                        paddingTop: insets.top,
                    },
                ]}
            >
                <EmptyState
                    icon="microphone-message"
                    title={COPY.chat.unavailableTitle}
                    message={COPY.chat.unavailableBody}
                />
            </View>
        );
    }

    return (
        <View
            ref={screenRef}
            onLayout={measure}
            style={[
                styles.screen,
                {backgroundColor: colors.background, paddingTop: insets.top},
            ]}
        >
            <View style={styles.header}>
                <View style={styles.headerText}>
                    <Text variant="title">{COPY.chat.title}</Text>
                    <Text variant="caption" tone="muted">
                        {chat.selected.length > 0
                            ? [
                                  ...chat.selected.map((v) => v.displayName),
                                  "tú",
                              ].join(", ")
                            : COPY.chat.members}
                    </Text>
                </View>
                <Pressable
                    onPress={openMenu}
                    hitSlop={HIT_SLOP}
                    accessibilityRole="button"
                    accessibilityLabel={COPY.chat.menu}
                >
                    <Icon
                        name="dots-vertical"
                        size={24}
                        color={colors.textMuted}
                    />
                </Pressable>
            </View>

            <View
                style={[
                    styles.notice,
                    {
                        backgroundColor: colors.glass,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Icon name="robot-outline" size={16} color={colors.info} />
                <Text variant="caption" tone="muted" style={styles.noticeText}>
                    {COPY.chat.aiNotice}
                </Text>
            </View>

            <VoicePicker
                voices={chat.voices}
                selectedIds={chat.selected.map((v) => v.id)}
                onToggle={chat.toggleVoice}
            />

            {data.length === 0 ? (
                <View style={styles.empty}>
                    <EmptyState
                        icon="microphone-message"
                        title={COPY.chat.emptyTitle}
                        message={COPY.chat.emptyBody}
                    />
                </View>
            ) : (
                <FlatList
                    style={styles.list}
                    data={data}
                    inverted
                    keyExtractor={(m) => m.id}
                    renderItem={renderItem}
                    // Re-render rows as playback moves, not only as data does.
                    extraData={playback}
                    ItemSeparatorComponent={Separator}
                    ListHeaderComponent={
                        chat.recording ? (
                            <View style={styles.recording}>
                                <RecordingIndicator
                                    name={chat.recording.displayName}
                                />
                            </View>
                        ) : undefined
                    }
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                />
            )}

            {chat.banner ? (
                <Text
                    variant="caption"
                    tone="warning"
                    style={styles.banner}
                    accessibilityLiveRegion="polite"
                >
                    {chat.banner}
                </Text>
            ) : null}

            <View style={{paddingBottom: composerBottom}}>
                <Composer busy={chat.busy} onSend={chat.send} />
            </View>
        </View>
    );
};

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
    screen: {flex: 1},
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: SPACE.md,
        paddingVertical: SPACE.sm,
    },
    headerText: {flex: 1},
    notice: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.xs,
        marginHorizontal: SPACE.md,
        padding: SPACE.xs,
        borderRadius: RADII.sm,
        borderWidth: 1,
    },
    noticeText: {flex: 1},
    list: {flex: 1},
    listContent: {padding: SPACE.md},
    separator: {height: SPACE.sm},
    empty: {flex: 1, justifyContent: "center"},
    recording: {paddingBottom: SPACE.sm},
    banner: {paddingHorizontal: SPACE.md, paddingTop: SPACE.xs},
});
