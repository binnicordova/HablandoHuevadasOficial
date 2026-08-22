import type {Href} from "expo-router";

type WebPath = (uri: string, title: string) => Href;
type VideoPath = (id: string) => Href;

interface PathsProps {
    HOME: Href;
    SHORTS: Href;
    SEARCH: Href;
    ME: Href;
    VIDEO: VideoPath;
    WEB: WebPath;
}

export const PATHS: PathsProps = {
    HOME: "/",
    SHORTS: "/shorts",
    SEARCH: "/search",
    ME: "/me",
    VIDEO: (id) => `/video/${encodeURIComponent(id)}` as Href,
    WEB: (uri, title) =>
        `/web?uri=${encodeURIComponent(uri)}&title=${encodeURIComponent(title)}` as Href,
};
