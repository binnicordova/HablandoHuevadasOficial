import type {ScriptWriter} from "@/chat/application/ports";
import {
    chatMessages,
    chatSystemPrompt,
    type Limits,
    parseScript,
} from "@/chat/domain/persona";

export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const TIMEOUT_MS = 30_000;

export const SCRIPT_LIMITS: Limits = {maxTurns: 3, maxWordsPerTurn: 22};

export type DeepSeekConfig = {
    apiKey: string;
    model: string;
};

/**
 * Has DeepSeek write the reply in the selected personajes' voices (OpenAI-
 * compatible chat API, JSON mode: the system prompt spells out the JSON shape,
 * which the API requires).
 *
 * The key is bundled with the app, so anyone who unpacks the app can read it:
 * treat it as a key that may leak (a spend cap on it, rotate it) and keep it
 * out of git. `EXPO_PUBLIC_DEEPSEEK_API_KEY` is read at build time.
 */
export const deepseekScriptWriter = ({
    apiKey,
    model,
}: DeepSeekConfig): ScriptWriter => ({
    async write(message, history, voices) {
        const response = await fetch(DEEPSEEK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: "system",
                        content: chatSystemPrompt(voices, SCRIPT_LIMITS),
                    },
                    ...chatMessages(message, history),
                ],
                response_format: {type: "json_object"},
                temperature: 1.0,
                max_tokens: 400,
                stream: false,
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}`);
        const body = (await response.json()) as {
            choices?: {message?: {content?: string}}[];
        };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string")
            throw new Error("DeepSeek: no content");
        return parseScript(content, voices, SCRIPT_LIMITS);
    },
});
