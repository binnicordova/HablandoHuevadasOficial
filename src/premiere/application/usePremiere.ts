import {useAtomValue} from "jotai";
import {useEffect, useRef} from "react";
import {syncCatalog} from "@/catalog";
import {successFeedback} from "@/utils/haptics";
import {premiereLockedIdAtom, premiereViewAtom} from "./premiereAtoms";
import type {PremiereView} from "./premiereView";

/**
 * The next premiere as a view (or `null`), plus the one-shot "it just went
 * live" side effects: a haptic, and a forced catalog refresh so the dataset's
 * `live_status` catches up with what the user is already looking at.
 */
export const usePremiere = (): PremiereView | null => {
    const view = useAtomValue(premiereViewAtom);
    const previous = useRef<PremiereView | null>(null);

    useEffect(() => {
        const before = previous.current;
        previous.current = view;
        const wentLive =
            before !== null &&
            view !== null &&
            before.id === view.id &&
            view.phase === "live" &&
            (before.phase === "scheduled" || before.phase === "imminent");
        if (!wentLive) return;
        successFeedback();
        void syncCatalog({force: true});
    }, [view]);

    return view;
};

/** Id of the episode to keep out of the player for now (see the atom). */
export const usePremiereLockedId = (): string | null =>
    useAtomValue(premiereLockedIdAtom);
