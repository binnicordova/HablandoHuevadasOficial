import type {VoiceProfile} from "../types";
import type {BlobStore} from "./blobs";

export const VOICE_ID = /^[a-z0-9][a-z0-9-]{1,40}$/;

/** Where a voice's files live. Shared with the TTS codebase and the uploader. */
export const voicePaths = (id: string) => ({
    sample: `voices/${id}/sample.wav`,
    transcript: `voices/${id}/sample.txt`,
    profile: `voices/${id}/profile.json`,
});

export interface VoiceRegistry {
    list(): Promise<VoiceProfile[]>;
    get(id: string): Promise<VoiceProfile | null>;
}

const DEFAULT_PERSONA =
    "Peruano, achorado y amistoso, habla como un pata con frases cortas.";
const CACHE_MS = 60_000;

const stringOr = (value: unknown, fallback: string): string =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;

/**
 * Voices are folders in Storage: drop `sample.wav` (3 to 15 s of clean speech)
 * and `sample.txt` (what is said in it) under `voices/<id>/` and the voice
 * exists. An optional `profile.json` carries its name and personality:
 *
 *     {"slug": "ricardo", "displayName": "Ricardo", "persona": "...",
 *      "language": "es"}
 *
 * Nothing is deployed to add or change one. A folder missing either sample
 * file is not listed: a half-uploaded voice never reaches the TTS.
 */
export class StorageVoiceRegistry implements VoiceRegistry {
    private cache: {at: number; voices: VoiceProfile[]} | null = null;

    constructor(
        private readonly blobs: BlobStore,
        private readonly now: () => number = Date.now
    ) {}

    async list(): Promise<VoiceProfile[]> {
        if (this.cache && this.now() - this.cache.at < CACHE_MS)
            return this.cache.voices;

        const names = await this.blobs.list("voices/");
        const byId = new Map<string, Set<string>>();
        for (const name of names) {
            const [, id, file] = name.split("/");
            if (!id || !file || !VOICE_ID.test(id)) continue;
            byId.set(id, (byId.get(id) ?? new Set()).add(file));
        }

        const voices: VoiceProfile[] = [];
        for (const [id, files] of byId) {
            if (!files.has("sample.wav") || !files.has("sample.txt")) continue;
            voices.push(await this.load(id, files.has("profile.json")));
        }
        voices.sort((a, b) => a.id.localeCompare(b.id));
        this.cache = {at: this.now(), voices};
        return voices;
    }

    async get(id: string): Promise<VoiceProfile | null> {
        if (!VOICE_ID.test(id)) return null;
        return (await this.list()).find((voice) => voice.id === id) ?? null;
    }

    private async load(id: string, hasProfile: boolean): Promise<VoiceProfile> {
        let raw: Record<string, unknown> = {};
        if (hasProfile) {
            try {
                const buffer = await this.blobs.read(voicePaths(id).profile);
                if (buffer) raw = JSON.parse(buffer.toString("utf8"));
            } catch {
                /* a broken profile.json must not hide the voice */
            }
        }
        const slug = id.replace(/-sample$/, "");
        return {
            id,
            slug: stringOr(raw.slug, slug).toLowerCase(),
            displayName: stringOr(
                raw.displayName,
                slug.charAt(0).toUpperCase() + slug.slice(1)
            ),
            persona: stringOr(raw.persona, DEFAULT_PERSONA),
            language: stringOr(raw.language, "es"),
        };
    }
}
