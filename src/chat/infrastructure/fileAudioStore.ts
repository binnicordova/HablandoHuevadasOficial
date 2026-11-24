import {Directory, File, Paths} from "expo-file-system";
import type {AudioStore} from "@/chat/application/ports";
import {authHeaders} from "@/chat/infrastructure/httpVoiceApi";

/**
 * Voice notes live on the server for a day, the chat history for much longer,
 * so every note is copied into the app's own documents folder on arrival.
 * Documents, not cache: the OS may empty the cache and leave mute bubbles.
 */
export const fileAudioStore = (
    baseUrl: string,
    apiKey?: string
): AudioStore => {
    const base = baseUrl.replace(/\/$/, "");
    const folder = () => new Directory(Paths.document, "chat-audio");

    return {
        async save(audioUrl) {
            const dir = folder();
            if (!dir.exists) dir.create({intermediates: true});
            const name = audioUrl.split("/").pop() ?? `${Date.now()}.m4a`;
            const target = new File(dir, name);
            if (target.exists) return target.uri;
            const file = await File.downloadFileAsync(
                `${base}${audioUrl}`,
                target,
                {
                    headers: await authHeaders(apiKey),
                }
            );
            return file.uri;
        },
        async remove(uris) {
            for (const uri of uris) {
                try {
                    const file = new File(uri);
                    if (file.exists) file.delete();
                } catch {
                    /* already gone */
                }
            }
        },
        async clear() {
            try {
                const dir = folder();
                if (dir.exists) dir.delete();
            } catch {
                /* nothing to clear */
            }
        },
    };
};
