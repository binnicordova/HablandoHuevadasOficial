import type {Firestore} from "firebase-admin/firestore";

export interface LimitConfig {
    perMinute: number;
    perDay: number;
    globalPerDay: number;
}

export type Refusal = "minute" | "day" | "global_day";

export interface RateLimiter {
    /** Records a hit and returns null, or why it was refused. */
    allow(installId: string, now?: number): Promise<Refusal | null>;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Pure rule: given the install's hits so far, may this one through? */
export const decide = (
    hits: readonly number[],
    now: number,
    config: LimitConfig
): {refusal: Refusal | null; kept: number[]} => {
    const kept = hits.filter((t) => now - t <= DAY);
    if (kept.length >= config.perDay) return {refusal: "day", kept};
    if (kept.filter((t) => now - t <= MINUTE).length >= config.perMinute)
        return {refusal: "minute", kept};
    return {refusal: null, kept: [...kept, now]};
};

/** Per-install sliding windows plus one global daily cap, in Firestore. */
export class FirestoreRateLimiter implements RateLimiter {
    constructor(
        private readonly db: Firestore,
        private readonly config: LimitConfig
    ) {}

    allow(installId: string, now = Date.now()): Promise<Refusal | null> {
        const install = this.db.collection("limits").doc(installId);
        const day = new Date(now).toISOString().slice(0, 10);
        const global = this.db.collection("limits").doc(`global-${day}`);

        return this.db.runTransaction(async (tx) => {
            const [installSnap, globalSnap] = await Promise.all([
                tx.get(install),
                tx.get(global),
            ]);
            const count = (globalSnap.data()?.count as number | undefined) ?? 0;
            if (count >= this.config.globalPerDay) return "global_day";

            const {refusal, kept} = decide(
                (installSnap.data()?.hits as number[] | undefined) ?? [],
                now,
                this.config
            );
            if (refusal) return refusal;

            tx.set(install, {hits: kept, updatedAt: now});
            tx.set(global, {count: count + 1, updatedAt: now});
            return null;
        });
    }
}

export class MemoryRateLimiter implements RateLimiter {
    private readonly hits = new Map<string, number[]>();
    private global: number[] = [];

    constructor(private readonly config: LimitConfig) {}

    async allow(installId: string, now = Date.now()): Promise<Refusal | null> {
        this.global = this.global.filter((t) => now - t <= DAY);
        if (this.global.length >= this.config.globalPerDay) return "global_day";
        const {refusal, kept} = decide(
            this.hits.get(installId) ?? [],
            now,
            this.config
        );
        if (refusal) return refusal;
        this.hits.set(installId, kept);
        this.global.push(now);
        return null;
    }
}
