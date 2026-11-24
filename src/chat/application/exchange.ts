import {
    type AudioStore,
    ChatError,
    type ChatFailure,
    type ScriptWriter,
    type VoiceApi,
} from "@/chat/application/ports";
import {
    type ChatMessage,
    type HistoryEntry,
    newMessageId,
} from "@/chat/domain/message";
import {checkInput, checkOutput} from "@/chat/domain/safety";
import type {ScriptTurn, VoiceProfile} from "@/chat/domain/voice";

export type ExchangeResult =
    | {kind: "done"; replies: number}
    | {kind: "refused"; notice: string}
    | {kind: "failed"; reason: ChatFailure};

export type ExchangeDeps = {
    writer: ScriptWriter;
    voiceApi: VoiceApi;
    audio: AudioStore;
    now?: () => number;
    newId?: () => string;
};

export type ExchangeHooks = {
    /** A voice note is saved and ready to show. */
    onReply: (message: ChatMessage) => void;
    /** Who is "recording" right now, or null when nobody is. */
    onRecording: (voice: VoiceProfile | null) => void;
    isCancelled?: () => boolean;
};

/** Said when the LLM is down or writes nothing usable: the chat never hangs. */
const fallbackScript = (voices: readonly VoiceProfile[]): ScriptTurn[] => {
    const [first, second] = voices;
    const turns: ScriptTurn[] = [
        {
            voice: first.id,
            speaker: first.slug,
            text: "Se me cruzaron los cables, causa.",
        },
    ];
    if (second)
        turns.push({
            voice: second.id,
            speaker: second.slug,
            text: "Pregúntale de nuevo, pues.",
        });
    return turns;
};

const kindOf = (error: unknown): ChatFailure =>
    error instanceof ChatError ? error.kind : "failed";

/**
 * One message in, voice notes out.
 *
 * Checks the message, has the LLM write the reply in the selected personajes'
 * voices, then asks the voice service to speak each line and hands every note
 * to `onReply` as soon as its audio is on the device, in order. The script is
 * known up front, so "recording…" always names the right personaje.
 */
export const runExchange = async (
    message: string,
    history: HistoryEntry[],
    voices: VoiceProfile[],
    {
        writer,
        voiceApi,
        audio,
        now = Date.now,
        newId = newMessageId,
    }: ExchangeDeps,
    {onReply, onRecording, isCancelled = () => false}: ExchangeHooks
): Promise<ExchangeResult> => {
    const verdict = checkInput(message);
    if (!verdict.ok)
        return {
            kind: "refused",
            notice: verdict.notice ?? "De eso no hablamos, cro.",
        };
    if (voices.length === 0) return {kind: "failed", reason: "failed"};

    try {
        onRecording(voices[0]);
        let script: ScriptTurn[];
        try {
            script = (await writer.write(message, history, voices)).filter(
                (turn) => checkOutput(turn.text).ok
            );
        } catch {
            script = [];
        }
        if (script.length === 0) script = fallbackScript(voices);

        const byId = new Map(voices.map((v) => [v.id, v]));
        let delivered = 0;
        for (const turn of script) {
            if (isCancelled()) break;
            onRecording(byId.get(turn.voice) ?? null);
            try {
                const spoken = await voiceApi.speak(turn.voice, turn.text);
                const audioUri = await audio.save(spoken.audioUrl);
                onReply({
                    id: newId(),
                    speaker: turn.speaker,
                    name: byId.get(turn.voice)?.displayName,
                    text: turn.text,
                    createdAt: now(),
                    audioUri,
                    durationMs: spoken.durationMs,
                });
                delivered += 1;
            } catch (error) {
                // The service refusing one line is not the end of the reply.
                if (kindOf(error) === "refused_text") continue;
                if (delivered > 0) break; // keep what already arrived
                throw error;
            }
        }
        return delivered > 0
            ? {kind: "done", replies: delivered}
            : {kind: "failed", reason: "failed"};
    } catch (error) {
        return {kind: "failed", reason: kindOf(error)};
    } finally {
        onRecording(null);
    }
};
