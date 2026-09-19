import {useAtomValue} from "jotai";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {CatalogItem, VideoKind} from "@/models/video";
import {nextUp, type Rail} from "@/services/recommendations";
import {historyAtom, settingsAtom} from "@/stores/store";

/** Long enough to read the title and hit cancel, short enough to feel automatic. */
export const AUTOPLAY_SECONDS = 5;

type UseNextUpOptions = {
    /** Ranked rails for the surface. The first unseen item wins. */
    rails: Rail[];
    kind?: VideoKind;
    /** The clip on screen, so a surface never hands over to itself. */
    excludeId?: string;
    onAdvance: (item: CatalogItem) => void;
};

/**
 * The end-of-video handoff, shared by Inicio and the detail screen.
 *
 * A clip that finishes and leaves the user on a still frame is a session that
 * just ended, and both screens have a player that can end. The rule is the same
 * on either: pick the closest thing they have not seen, show it, and start it
 * on a countdown they can stop — but only when the user has left autoplay on.
 */
export const useNextUp = ({
    rails,
    kind,
    excludeId,
    onAdvance,
}: UseNextUpOptions) => {
    const history = useAtomValue(historyAtom);
    const settings = useAtomValue(settingsAtom);
    const [countdown, setCountdown] = useState<number | null>(null);

    const item = useMemo(
        () =>
            nextUp(rails, {
                watched: new Set(history.map((entry) => entry.id)),
                kind,
                exclude: excludeId,
            }),
        [rails, history, kind, excludeId]
    );

    /*
     * The tick effect below must depend on the countdown and nothing else — a
     * dependency that changes identity every render would clear and re-arm the
     * timer forever and the count would never reach zero. The moving parts ride
     * in refs instead.
     */
    const itemRef = useRef(item);
    itemRef.current = item;
    const advanceRef = useRef(onAdvance);
    advanceRef.current = onAdvance;

    /** The clip whose handoff the user turned down. */
    const dismissedRef = useRef<string | undefined>(undefined);

    /*
     * A new clip on screen makes any armed handoff — and any refusal of it —
     * belong to a clip that is no longer here. Reset during render rather than
     * in an effect so the stale countdown is never committed for a beat first.
     */
    const clipRef = useRef(excludeId);
    if (clipRef.current !== excludeId) {
        clipRef.current = excludeId;
        dismissedRef.current = undefined;
        if (countdown !== null) setCountdown(null);
    }

    /** Playback resumed on its own. Stops the timer without refusing a later one. */
    const clear = useCallback(() => setCountdown(null), []);

    /** The user said no. Stays refused for this clip, however it ends. */
    const dismiss = useCallback(() => {
        dismissedRef.current = excludeId;
        setCountdown(null);
    }, [excludeId]);

    /**
     * Called when a clip ends. Silent when autoplay is off, when nothing is
     * queued, or when the user already turned this one down.
     *
     * Idempotent on purpose: the embed reports `ended` more than once for a
     * single clip, and a plain assignment would keep pushing the countdown back
     * to five so it never actually fired.
     */
    const arm = useCallback(() => {
        if (!settings.autoplay || !item) return;
        if (dismissedRef.current === excludeId) return;
        setCountdown((current) => current ?? AUTOPLAY_SECONDS);
    }, [excludeId, item, settings.autoplay]);

    useEffect(() => {
        if (countdown === null) return;
        if (countdown <= 0) {
            setCountdown(null);
            const next = itemRef.current;
            if (next) advanceRef.current(next);
            return;
        }
        const timer = setTimeout(
            () => setCountdown((left) => (left ?? 1) - 1),
            1000
        );
        return () => clearTimeout(timer);
    }, [countdown]);

    return {item, countdown, arm, clear, dismiss};
};
