import {
    type AudioPlayer,
    type AudioSource,
    createAudioPlayer,
    setAudioModeAsync,
} from "expo-audio";
import {useCallback, useEffect, useRef, useState} from "react";
import {successFeedback, tapFeedback} from "@/utils/haptics";

/**
 * Soundboard playback.
 *
 * Players are created lazily per pad and kept alive, so the second tap on a pad
 * is instant. Tapping a pad while it is playing restarts it from zero — that is
 * how a soundboard is expected to behave, and it is why `seekTo(0)` comes
 * before `play()` instead of toggling pause.
 */
export const useSoundboard = () => {
    const players = useRef(new Map<string, AudioPlayer>());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [failedId, setFailedId] = useState<string | null>(null);

    useEffect(() => {
        // Pads should be audible even with the ringer switch off, and must not
        // silence background music permanently.
        setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: "mixWithOthers",
        }).catch(() => {});
    }, []);

    useEffect(() => {
        const active = players.current;
        return () => {
            for (const player of active.values()) {
                try {
                    player.remove();
                } catch {
                    /* already released */
                }
            }
            active.clear();
        };
    }, []);

    const stopAll = useCallback(() => {
        for (const player of players.current.values()) {
            try {
                player.pause();
                player.seekTo(0);
            } catch {
                /* already released */
            }
        }
        setActiveId(null);
    }, []);

    const play = useCallback((id: string, source: AudioSource | undefined) => {
        if (!source) {
            tapFeedback();
            return false;
        }

        try {
            let player = players.current.get(id);
            if (!player) {
                player = createAudioPlayer(source);
                players.current.set(id, player);
            }

            // Let a new pad cut off the previous one, like real hardware.
            for (const [otherId, other] of players.current) {
                if (otherId === id) continue;
                if (other.playing) other.pause();
            }

            player.seekTo(0);
            player.play();
            successFeedback();
            setActiveId(id);
            setFailedId(null);
            return true;
        } catch {
            setFailedId(id);
            setActiveId(null);
            return false;
        }
    }, []);

    return {play, stopAll, activeId, failedId};
};
