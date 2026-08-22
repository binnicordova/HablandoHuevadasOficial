/** Local calendar day as YYYY-MM-DD. Used as the streak and daily-pick key. */
export const dayKey = (date: Date = new Date()): string => {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
};

export const daysBetween = (from: string, to: string): number => {
    const a = new Date(`${from}T00:00:00`).getTime();
    const b = new Date(`${to}T00:00:00`).getTime();
    return Math.round((b - a) / 86_400_000);
};

/** Stable 32 bit hash so "pick of the day" is identical on every device. */
export const hashString = (input: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
};
