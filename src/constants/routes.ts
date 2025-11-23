import type {Href} from "expo-router";

type WebPath = (uri: string, title: string) => Href;

interface PathsProps {
    HOME: Href;
    WEB: WebPath;
}

export const PATHS: PathsProps = {
    HOME: "/",
    WEB: (uri, title) =>
        `/web?uri=${encodeURIComponent(uri)}&title=${encodeURIComponent(title)}`,
};
