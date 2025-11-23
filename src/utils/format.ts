export const formatViews = (views: number | null | undefined): string => {
    if (views === null || views === undefined) {
        return "";
    }
    if (views >= 1_000_000) {
        return `${(views / 1_000_000).toFixed(1)}M de vistas`;
    }
    if (views >= 1_000) {
        return `${Math.floor(views / 1_000)}K de vistas`;
    }
    return `${views} vistas`;
};
