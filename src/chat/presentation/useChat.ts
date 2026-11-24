import {useAtom} from "jotai";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {runExchange} from "@/chat/application/exchange";
import {
    type ChatMessage,
    isFromVoice,
    newMessageId,
    normalizeDraft,
    toHistory,
    trimMessages,
} from "@/chat/domain/message";
import {
    resolveSelection,
    toggleSelection,
    type VoiceProfile,
} from "@/chat/domain/voice";
import {
    cachedVoicesAtom,
    chatMessagesAtom,
    selectedVoiceIdsAtom,
} from "@/chat/infrastructure/chatStore";
import {deepseekScriptWriter} from "@/chat/infrastructure/deepseekScriptWriter";
import {fileAudioStore} from "@/chat/infrastructure/fileAudioStore";
import {httpVoiceApi} from "@/chat/infrastructure/httpVoiceApi";
import {COPY} from "@/constants/copy";
import {
    DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL,
    VOICE_API_KEY,
    VOICE_API_URL,
} from "@/constants/env";
import {track} from "@/services/analytics";

const FAILURE_COPY = {
    offline: COPY.chat.offline,
    rate_limited: COPY.chat.rateLimited,
    refused_text: COPY.chat.failed,
    failed: COPY.chat.failed,
} as const;

/** The chat needs both halves: somewhere to speak and something to write. */
export const CHAT_AVAILABLE =
    VOICE_API_URL.length > 0 && DEEPSEEK_API_KEY.length > 0;

/**
 * The chat's state and its verbs: pick personajes, send, clear, report.
 *
 * Messages, the voice list and the selection persist (see chatStore). The
 * in-flight bits, who is recording and the banner line, are screen state and
 * start clean every launch.
 */
export const useChat = () => {
    const [messages, setMessages] = useAtom(chatMessagesAtom);
    const [voices, setVoices] = useAtom(cachedVoicesAtom);
    const [selectedIds, setSelectedIds] = useAtom(selectedVoiceIdsAtom);
    const [recording, setRecording] = useState<VoiceProfile | null>(null);
    const [banner, setBanner] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const alive = useRef(true);
    const latest = useRef(messages);
    latest.current = messages;

    const {voiceApi, writer, audio} = useMemo(
        () => ({
            voiceApi: httpVoiceApi({
                baseUrl: VOICE_API_URL,
                apiKey: VOICE_API_KEY,
            }),
            writer: deepseekScriptWriter({
                apiKey: DEEPSEEK_API_KEY,
                model: DEEPSEEK_MODEL,
            }),
            audio: fileAudioStore(VOICE_API_URL, VOICE_API_KEY),
        }),
        []
    );

    useEffect(() => {
        alive.current = true;
        if (CHAT_AVAILABLE) {
            voiceApi
                .listVoices()
                .then((list) => alive.current && setVoices(list))
                .catch(() => {
                    /* keep the cached list: the picker still works offline */
                });
            // Fire and forget: the first line then finds the TTS already up.
            voiceApi.warm().catch(() => {});
        }
        return () => {
            alive.current = false;
        };
    }, [voiceApi, setVoices]);

    const selected = useMemo(
        () => resolveSelection(voices, selectedIds),
        [voices, selectedIds]
    );

    const toggleVoice = useCallback(
        (id: string) =>
            setSelectedIds(
                toggleSelection(
                    selected.map((v) => v.id),
                    id
                )
            ),
        [selected, setSelectedIds]
    );

    const append = useCallback(
        (message: ChatMessage) => setMessages((prev) => [...prev, message]),
        [setMessages]
    );

    const markDelivery = useCallback(
        (id: string, delivery: ChatMessage["delivery"]) =>
            setMessages((prev) =>
                prev.map((m) => (m.id === id ? {...m, delivery} : m))
            ),
        [setMessages]
    );

    const exchange = useCallback(
        async (userMessage: ChatMessage) => {
            const history = toHistory(
                latest.current.filter((m) => m.id !== userMessage.id)
            );
            const startedAt = Date.now();
            setBusy(true);
            setBanner(null);
            markDelivery(userMessage.id, "sent");
            track({name: "chat_sent", length: userMessage.text.length});

            const result = await runExchange(
                userMessage.text,
                history,
                selected,
                {writer, voiceApi, audio},
                {
                    onReply: append,
                    onRecording: (voice) =>
                        alive.current && setRecording(voice),
                    isCancelled: () => !alive.current,
                }
            );

            if (!alive.current) return;
            setBusy(false);
            if (result.kind === "done") {
                track({
                    name: "chat_reply",
                    replies: result.replies,
                    ms: Date.now() - startedAt,
                });
                const {kept, dropped} = trimMessages(latest.current);
                if (dropped.length > 0) {
                    setMessages(kept);
                    audio.remove(
                        dropped.flatMap((m) => (m.audioUri ? [m.audioUri] : []))
                    );
                }
            } else if (result.kind === "refused") {
                track({name: "chat_refused"});
                setBanner(result.notice);
            } else {
                track({name: "chat_failed", reason: result.reason});
                // Nothing came back: the user's own message is what failed.
                if (result.reason !== "rate_limited")
                    markDelivery(userMessage.id, "failed");
                setBanner(FAILURE_COPY[result.reason]);
            }
        },
        [audio, append, markDelivery, selected, setMessages, voiceApi, writer]
    );

    const send = useCallback(
        (draft: string) => {
            const text = normalizeDraft(draft);
            if (!text || busy || selected.length === 0) return false;
            const message: ChatMessage = {
                id: newMessageId(),
                speaker: "user",
                text,
                createdAt: Date.now(),
                delivery: "sent",
            };
            append(message);
            exchange(message);
            return true;
        },
        [append, busy, exchange, selected.length]
    );

    const retry = useCallback(
        (id: string) => {
            const message = latest.current.find((m) => m.id === id);
            if (!message || busy) return;
            exchange(message);
        },
        [busy, exchange]
    );

    const clear = useCallback(async () => {
        setMessages([]);
        setBanner(null);
        await audio.clear();
    }, [audio, setMessages]);

    const report = useCallback(
        async (message: ChatMessage): Promise<boolean> => {
            if (!isFromVoice(message)) return false;
            track({name: "chat_report", speaker: message.speaker});
            try {
                await voiceApi.report({
                    speaker: message.speaker,
                    text: message.text,
                });
                return true;
            } catch {
                return false;
            }
        },
        [voiceApi]
    );

    return {
        messages,
        voices,
        selected,
        recording,
        banner,
        busy,
        available: CHAT_AVAILABLE,
        toggleVoice,
        send,
        retry,
        clear,
        report,
    };
};
