import {Redirect, useLocalSearchParams} from "expo-router";
import {PATHS} from "@/constants/routes";

/**
 * `/video/:id` used to be its own pushed screen. The watch experience now
 * lives on Inicio (see `(tabs)/index.tsx`) so the player is never a second,
 * independent instance. This route stays only as a landing pad: the Android
 * intent filter and any old link still point at this exact path shape, and a
 * dead link is worse than a redirect.
 */
export default function VideoRedirect() {
    const {id} = useLocalSearchParams<{id: string}>();
    return <Redirect href={id ? PATHS.VIDEO(id) : PATHS.HOME} />;
}
