import {atom} from "jotai";
import type {CatalogItem} from "@/models/video";

export type NowPlaying = {
    item: CatalogItem;
    playing: boolean;
    /** Seconds to resume from. Consumed once by the player, on first boot of this id. */
    startAt: number;
};

/**
 * The one episode the global player is showing, or `null` when nothing is
 * loaded. Shorts deliberately never write an item in here — they run their own
 * local player (see Shorts.tsx) and only ever pause this one, so a short never
 * fights the hero for audio.
 */
export const nowPlayingAtom = atom<NowPlaying | null>(null);

/**
 * Whether Inicio — the one screen that hosts the hero player inline — is the
 * screen currently on top. `false` covers every other tab and stack screen,
 * where the player has nowhere inline to sit and falls back to the floating
 * PIP (see GlobalPlayerHost / PlayerUIProvider for where it actually gets
 * drawn — this atom only answers "is there an inline slot to draw into").
 */
export const heroFocusedAtom = atom(false);

/**
 * Last state-change reported by the singleton. A new object every time (even
 * for a repeated event string) so a plain reference-equality subscriber
 * always re-fires — there is no reducer here, just a broadcast.
 */
export type PlayerEvent = {event: string; itemId: string} | null;
export const playerEventAtom = atom<PlayerEvent>(null);

type PlayPayload = {
    item: CatalogItem;
    startAt?: number;
    playing?: boolean;
};

/** Loads an item into the hero player. Used to start or swap in place. */
export const setNowPlayingAtom = atom(
    null,
    (_get, set, payload: PlayPayload) => {
        set(nowPlayingAtom, {
            item: payload.item,
            playing: payload.playing ?? true,
            startAt: payload.startAt ?? 0,
        });
    }
);

/** Play/pause without touching what is loaded. */
export const setHeroPlayingAtom = atom(null, (get, set, playing: boolean) => {
    const current = get(nowPlayingAtom);
    if (!current) return;
    set(nowPlayingAtom, {...current, playing});
});

/**
 * Silences the hero without forgetting it, so a short can take over the one
 * audio track the app ever plays at once and the mini player still shows
 * what to resume on the way back.
 */
export const pauseHeroAtom = atom(null, (get, set) => {
    const current = get(nowPlayingAtom);
    if (current?.playing) set(nowPlayingAtom, {...current, playing: false});
});

/** The PIP's close button: stop and forget. */
export const clearNowPlayingAtom = atom(null, (_get, set) => {
    set(nowPlayingAtom, null);
});

export const emitPlayerEventAtom = atom(
    null,
    (_get, set, payload: {event: string; itemId: string}) => {
        set(playerEventAtom, payload);
    }
);
