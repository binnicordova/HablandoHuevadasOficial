import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from "expo-audio";
import {useCallback, useEffect, useRef, useState} from "react";
import type {ChatMessage} from "@/chat/domain/message";
import {track} from "@/services/analytics";

/**
 * One player for the whole thread, WhatsApp style: tap a note to play it, tap
 * again to pause, and when it ends the next voice note in the thread starts.
 * Nothing plays by itself when a reply lands; a stranger's phone in a quiet
 * room should not suddenly talk.
 */
export const usePlayback = (messages: readonly ChatMessage[]) => {
    const player = useAudioPlayer(null);
    const status = useAudioPlayerStatus(player);
    const [currentId, setCurrentId] = useState<string | null>(null);

    const thread = useRef(messages);
    thread.current = messages;

    useEffect(() => {
        // Voice notes should be heard with the ringer switch on silent.
        setAudioModeAsync({playsInSilentMode: true}).catch(() => {});
    }, []);

    const start = useCallback(
        (message: ChatMessage) => {
            if (!message.audioUri) return;
            player.replace({uri: message.audioUri});
            player.play();
            setCurrentId(message.id);
            track({name: "chat_audio_play", speaker: message.speaker});
        },
        [player]
    );

    const toggle = useCallback(
        (message: ChatMessage) => {
            if (currentId === message.id) {
                if (status.playing) player.pause();
                else player.play();
                return;
            }
            start(message);
        },
        [currentId, player, start, status.playing]
    );

    useEffect(() => {
        if (!status.didJustFinish || currentId === null) return;
        const notes = thread.current.filter((m) => m.audioUri);
        const index = notes.findIndex((m) => m.id === currentId);
        const next = index >= 0 ? notes[index + 1] : undefined;
        if (next) start(next);
        else setCurrentId(null);
    }, [status.didJustFinish, currentId, start]);

    const progress =
        currentId !== null && status.duration > 0
            ? Math.min(1, status.currentTime / status.duration)
            : 0;

    return {
        currentId,
        playing: status.playing,
        progress,
        toggle,
    };
};
