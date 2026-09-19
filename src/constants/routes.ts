import type {Href} from "expo-router";

type WebPath = (uri: string, title: string) => Href;
type VideoPath = (id: string) => Href;
type ShortPath = (id: string) => Href;

interface PathsProps {
    HOME: Href;
    SHORTS: Href;
    /** The vertical feed, opened on one specific short. */
    SHORT: ShortPath;
    SEARCH: Href;
    FAVORITES: Href;
    ME: Href;
    VIDEO: VideoPath;
    WEB: WebPath;
}

export const PATHS: PathsProps = {
    HOME: "/",
    SHORTS: "/shorts",
    SHORT: (id) => `/shorts?id=${encodeURIComponent(id)}` as Href,
    SEARCH: "/search",
    FAVORITES: "/favorites",
    ME: "/me",
    VIDEO: (id) => `/video/${encodeURIComponent(id)}` as Href,
    WEB: (uri, title) =>
        `/web?uri=${encodeURIComponent(uri)}&title=${encodeURIComponent(title)}` as Href,
};
