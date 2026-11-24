/** A personaje: a voice in Storage plus the personality its replies are written in. */
export interface VoiceProfile {
    /** Storage folder, e.g. "ricardo-sample". */
    id: string;
    /** Short key shown as the speaker, e.g. "ricardo". */
    slug: string;
    displayName: string;
    persona: string;
    language: string;
}

/** One line of a reply, before it is voiced. */
export interface ScriptTurn {
    voice: string;
    speaker: string;
    text: string;
}

export interface SpeakResult {
    /** Path under the voice API, `/v1/audio/<hash>.m4a`. */
    audioUrl: string;
    durationMs: number;
}

export const MAX_SELECTED_VOICES = 3;
/** With no saved choice, the show's two hosts answer, if they are in the list. */
const DEFAULT_VOICE_IDS = ["jorge-sample", "ricardo-sample"];
const DEFAULT_SELECTION = 2;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const str = (value: unknown, what: string): string => {
    if (typeof value !== "string" || !value)
        throw new Error(`Voice: bad ${what}`);
    return value;
};

/** Validates the untrusted `GET /v1/voices` body. Anything off the contract throws. */
export const parseVoices = (raw: unknown): VoiceProfile[] => {
    if (!isRecord(raw) || !Array.isArray(raw.voices))
        throw new Error("Voices: bad body");
    return raw.voices.map((item): VoiceProfile => {
        if (!isRecord(item)) throw new Error("Voices: bad item");
        return {
            id: str(item.id, "id"),
            slug: str(item.slug, "slug"),
            displayName: str(item.displayName, "name"),
            persona: typeof item.persona === "string" ? item.persona : "",
            language: typeof item.language === "string" ? item.language : "es",
        };
    });
};

export const parseSpeak = (raw: unknown): SpeakResult => {
    if (!isRecord(raw)) throw new Error("Speak: bad body");
    const {audioUrl, durationMs} = raw;
    if (typeof audioUrl !== "string" || !audioUrl.startsWith("/v1/audio/"))
        throw new Error("Speak: bad audio url");
    if (typeof durationMs !== "number") throw new Error("Speak: bad duration");
    return {audioUrl, durationMs};
};

/** The saved choice restricted to voices that still exist, or a default. */
export const resolveSelection = (
    voices: readonly VoiceProfile[],
    ids: readonly string[]
): VoiceProfile[] => {
    const chosen = ids
        .map((id) => voices.find((v) => v.id === id))
        .filter((v): v is VoiceProfile => v !== undefined);
    if (chosen.length > 0) return chosen;
    const hosts = DEFAULT_VOICE_IDS.map((id) =>
        voices.find((v) => v.id === id)
    ).filter((v): v is VoiceProfile => v !== undefined);
    return hosts.length > 0 ? hosts : voices.slice(0, DEFAULT_SELECTION);
};

/** Adds or removes one voice; never empties the selection or exceeds the cap. */
export const toggleSelection = (
    ids: readonly string[],
    id: string,
    max = MAX_SELECTED_VOICES
): string[] => {
    if (ids.includes(id))
        return ids.length > 1 ? ids.filter((i) => i !== id) : [...ids];
    return [...ids, id].slice(-max);
};
