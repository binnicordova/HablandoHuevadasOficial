/** A voice that lives in Storage under `voices/<id>/` (see services/voices). */
export interface VoiceProfile {
    /** Folder name, e.g. "ricardo-sample". */
    id: string;
    /** Short key the app uses for this personaje, e.g. "ricardo". */
    slug: string;
    displayName: string;
    /** Who this personaje is, in a few lines. The app feeds it to its LLM. */
    persona: string;
    language: string;
}

export interface SynthesisResult {
    /** Storage path of the m4a, `audio/<sha256>.m4a`. */
    path: string;
    durationMs: number;
    cached: boolean;
}
