import type {HistoryEntry} from "@/chat/domain/message";
import type {ScriptTurn, SpeakResult, VoiceProfile} from "@/chat/domain/voice";

export type ChatFailure =
    | "offline"
    | "rate_limited"
    | "refused_text"
    | "failed";

/** Thrown by an adapter so the use case can tell the user something useful. */
export class ChatError extends Error {
    constructor(
        readonly kind: ChatFailure,
        message?: string
    ) {
        super(message ?? kind);
        this.name = "ChatError";
    }
}

/**
 * Writes what the personajes say. Runs in the app, with the user's own LLM
 * key (DeepSeek): the voice service never sees a prompt, only finished lines.
 */
export interface ScriptWriter {
    write(
        message: string,
        history: HistoryEntry[],
        voices: VoiceProfile[]
    ): Promise<ScriptTurn[]>;
}

/** The voice microservice: who can speak, and text to speech for one of them. */
export interface VoiceApi {
    listVoices(): Promise<VoiceProfile[]>;
    speak(voiceId: string, text: string): Promise<SpeakResult>;
    /** Wakes the voice service so a cold start overlaps with the user typing. */
    warm(): Promise<void>;
    report(entry: {speaker: string; text: string}): Promise<void>;
}

export interface AudioStore {
    /** Downloads a voice note and returns the local file URI. */
    save(audioUrl: string): Promise<string>;
    remove(uris: readonly string[]): Promise<void>;
    clear(): Promise<void>;
}
