import {GoogleAuth} from "google-auth-library";
import type {SynthesisResult} from "../types";

/** Turns text into a voice note in a stored voice. */
export interface TtsClient {
    synthesize(voice: string, text: string): Promise<SynthesisResult>;
    /** Wakes the service so its model is loaded before the first line. */
    warm?(): Promise<void>;
}

// A cold start loads a multi-GB model before the first word is synthesized.
const TIMEOUT_MS = 8 * 60_000;
const WARM_TIMEOUT_MS = 3 * 60_000;

/**
 * Cloud Run checks the ID token's audience against the service URL: the origin
 * only, never the path. A token minted for ".../synthesize" would be refused.
 */
/**
 * google-auth-library v10 returns a web `Headers`, older versions a plain
 * object. `Object.assign` copies nothing from a `Headers`, which silently
 * dropped the Authorization header and made Cloud Run answer 403.
 */
export const headersToRecord = (
    headers: Headers | Record<string, string>
): Record<string, string> =>
    headers instanceof Headers
        ? Object.fromEntries(headers.entries())
        : {...headers};

export const audienceOf = (url: string): string => new URL(url).origin;

const isSynthesisResult = (value: unknown): value is SynthesisResult => {
    const v = value as Partial<SynthesisResult> | null;
    return (
        typeof v?.path === "string" &&
        /^audio\/[0-9a-f]{64}\.m4a$/.test(v.path) &&
        typeof v.durationMs === "number" &&
        typeof v.cached === "boolean"
    );
};

/**
 * Calls the Python `synthesize` function (see functions-tts/). It is private:
 * in the cloud the call carries a Google ID token minted for its URL; the
 * emulator has no IAM, so it goes out bare.
 */
export class HttpTtsClient implements TtsClient {
    private readonly auth = new GoogleAuth();

    constructor(
        private readonly url: string,
        private readonly useIdToken: boolean = !process.env.FUNCTIONS_EMULATOR
    ) {}

    private async authHeaders(): Promise<Record<string, string>> {
        if (!this.useIdToken) return {};
        const client = await this.auth.getIdTokenClient(audienceOf(this.url));
        return headersToRecord(await client.getRequestHeaders());
    }

    async warm(): Promise<void> {
        // Not /healthz: Cloud Run's frontend reserves it and answers 404 itself,
        // so a request there never reaches (or wakes) the container.
        const response = await fetch(`${audienceOf(this.url)}/ready`, {
            headers: await this.authHeaders(),
            signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
        });
        await response.arrayBuffer();
        if (!response.ok) throw new Error(`TTS warm HTTP ${response.status}`);
    }

    async synthesize(voice: string, text: string): Promise<SynthesisResult> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(await this.authHeaders()),
        };
        const response = await fetch(this.url, {
            method: "POST",
            headers,
            body: JSON.stringify({voice, text}),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`TTS HTTP ${response.status}`);
        const body: unknown = await response.json();
        if (!isSynthesisResult(body)) throw new Error("TTS: bad response");
        return body;
    }
}
