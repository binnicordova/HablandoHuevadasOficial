import {useRouter} from "expo-router";
import {useCallback} from "react";
import {PATHS} from "@/constants/routes";
import type {CatalogItem} from "@/models/video";

/**
 * Opens a clip on the surface built for it.
 *
 * A short in a landscape detail player is a short with black bars and no way to
 * flick to the next one — which is the entire reason anyone watches shorts. So
 * shorts go to the vertical feed, positioned on that clip, and the user carries
 * on swiping from there. Episodes go to the detail screen.
 *
 * Every list in the app routes through this: Inicio, Buscar, Guardados, Mi zona
 * and the rails under the player. Repeating the `kind` branch at each call site
 * is how one of them ends up sending shorts to the wrong screen.
 */
export const useOpenItem = () => {
    const router = useRouter();

    return useCallback(
        (item: CatalogItem) => {
            if (item.kind === "short") {
                // `navigate` rather than `push`: the feed is a tab, and pushing
                // one stacks a second copy of it behind the first.
                router.navigate(PATHS.SHORT(item.id));
                return;
            }
            // Same reasoning: the watch screen is the Inicio tab now, not a
            // pushed screen.
            router.navigate(PATHS.VIDEO(item.id));
        },
        [router]
    );
};
