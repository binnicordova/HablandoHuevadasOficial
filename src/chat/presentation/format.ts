/** 7400 -> "0:07". Rounds up so a 0.4s note never reads 0:00. */
export const formatDuration = (ms: number | undefined): string => {
    const total = Math.max(1, Math.ceil((ms ?? 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};
