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

/** Seconds -> "1:17:27" / "4:32". Mirrors the dataset's duration_string. */
export const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds || seconds <= 0) return "";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const pad = (n: number) => `${n}`.padStart(2, "0");
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(secs)}`
        : `${minutes}:${pad(secs)}`;
};

export const formatRelativeTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "hace un momento";
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "ayer";
    if (days < 30) return `hace ${days} días`;
    const months = Math.floor(days / 30);
    return months === 1 ? "hace un mes" : `hace ${months} meses`;
};

/** Accent/case insensitive text used for search matching. */
export const normalize = (value: string): string =>
    value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
