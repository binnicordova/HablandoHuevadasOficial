import type {AudioStore} from "@/chat/application/ports";
import {authHeaders} from "@/chat/infrastructure/httpVoiceApi";

/**
 * Web has no documents folder and an <audio> tag cannot send our headers, so
 * each note is fetched with them and played from a blob URL. Those live for
 * the tab's lifetime; after a reload old notes are mute, which is acceptable
 * for a development target.
 */
export const fileAudioStore = (
    baseUrl: string,
    apiKey?: string
): AudioStore => {
    const base = baseUrl.replace(/\/$/, "");
    return {
        async save(audioUrl) {
            const response = await fetch(`${base}${audioUrl}`, {
                headers: await authHeaders(apiKey),
            });
            if (!response.ok) throw new Error(`Audio ${response.status}`);
            return URL.createObjectURL(await response.blob());
        },
        async remove(uris) {
            for (const uri of uris) URL.revokeObjectURL(uri);
        },
        async clear() {},
    };
};
