import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {defineInt, defineString} from "firebase-functions/params";
import {onRequest} from "firebase-functions/v2/https";
import {createApp} from "./http/app";
import {StorageBlobStore} from "./services/blobs";
import {FirestoreRateLimiter} from "./services/limits";
import {HttpTtsClient} from "./services/tts";
import {StorageVoiceRegistry} from "./services/voices";

// URL of the Python `synthesize` function (tts-service/).
const TTS_URL = defineString("TTS_URL");
const API_KEY = defineString("API_KEY", {default: ""});
const LIMIT_PER_MINUTE = defineInt("LIMIT_PER_MINUTE", {default: 6});
const LIMIT_PER_DAY = defineInt("LIMIT_PER_DAY", {default: 120});
const LIMIT_GLOBAL_PER_DAY = defineInt("LIMIT_GLOBAL_PER_DAY", {default: 3000});

let app: ReturnType<typeof createApp> | null = null;

/** Built on first use: params have no value at deploy time. */
const getApp = () => {
    if (app) return app;
    const db = getFirestore();
    const blobs = new StorageBlobStore(getStorage().bucket());
    app = createApp({
        config: {apiKey: API_KEY.value(), maxTextChars: 280},
        voices: new StorageVoiceRegistry(blobs),
        blobs,
        tts: new HttpTtsClient(TTS_URL.value()),
        limiter: new FirestoreRateLimiter(db, {
            perMinute: LIMIT_PER_MINUTE.value(),
            perDay: LIMIT_PER_DAY.value(),
            globalPerDay: LIMIT_GLOBAL_PER_DAY.value(),
        }),
        report: async (entry) => {
            await db.collection("reports").add(entry);
        },
    });
    return app;
};

/**
 * Text-to-speech gateway the app calls. Base URL:
 * https://us-east1-<project>.cloudfunctions.net/voiceApi
 *
 *   GET  /v1/voices        the personajes found in Storage, with personality
 *   POST /v1/speak         {voice, text} -> audio of that text in that voice
 *   GET  /v1/audio/:file   a voice note
 *   POST /v1/report        flag a voice note
 *
 * It holds no LLM key: the app writes the text, this speaks it.
 */
export const voiceApi = onRequest(
    {
        region: "us-east1",
        maxInstances: 10,
        memory: "512MiB",
        // A /v1/speak call waits for the TTS, which may be cold-starting.
        timeoutSeconds: 540,
        invoker: "public",
    },
    (req, res) => getApp()(req, res)
);
