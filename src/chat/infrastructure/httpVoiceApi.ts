import {ChatError, type VoiceApi} from "@/chat/application/ports";
import {parseSpeak, parseVoices} from "@/chat/domain/voice";
import {getInstallId} from "@/chat/infrastructure/installId";

const QUICK_TIMEOUT_MS = 15_000;
// A cold TTS instance loads a multi-GB model before it speaks its first word
// (about 90 s measured on Cloud Run), then ~15 s per line.
const SPEAK_TIMEOUT_MS = 180_000;
const WARM_TIMEOUT_MS = 240_000;

export type HttpVoiceApiConfig = {
    baseUrl: string;
    apiKey?: string;
};

export const authHeaders = async (
    apiKey?: string
): Promise<Record<string, string>> => ({
    "X-Install-Id": await getInstallId(),
    ...(apiKey ? {"X-Api-Key": apiKey} : {}),
});

export const httpVoiceApi = ({
    baseUrl,
    apiKey,
}: HttpVoiceApiConfig): VoiceApi => {
    const base = baseUrl.replace(/\/$/, "");

    const call = async (
        path: string,
        timeoutMs: number,
        init: RequestInit = {}
    ) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try {
            response = await fetch(`${base}${path}`, {
                ...init,
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    ...(await authHeaders(apiKey)),
                },
            });
        } catch {
            // No route, refused, timed out: the service is down or asleep.
            throw new ChatError("offline");
        } finally {
            clearTimeout(timer);
        }
        if (response.status === 429) throw new ChatError("rate_limited");
        if (response.status === 422) throw new ChatError("refused_text");
        if (response.status >= 502 && response.status <= 504)
            throw new ChatError("offline");
        if (!response.ok)
            throw new ChatError("failed", `HTTP ${response.status}`);
        return response;
    };

    return {
        async listVoices() {
            const response = await call("/v1/voices", QUICK_TIMEOUT_MS);
            return parseVoices(await response.json());
        },
        async speak(voiceId, text) {
            const response = await call("/v1/speak", SPEAK_TIMEOUT_MS, {
                method: "POST",
                body: JSON.stringify({voice: voiceId, text}),
            });
            return parseSpeak(await response.json());
        },
        async warm() {
            await call("/v1/warm", WARM_TIMEOUT_MS, {method: "POST"});
        },
        async report(entry) {
            await call("/v1/report", QUICK_TIMEOUT_MS, {
                method: "POST",
                body: JSON.stringify(entry),
            });
        },
    };
};
