import express, {
    type NextFunction,
    type Request,
    type RequestHandler,
    type Response,
} from "express";
import {checkSpeakable} from "../domain/safety";
import type {BlobStore} from "../services/blobs";
import type {RateLimiter} from "../services/limits";
import type {TtsClient} from "../services/tts";
import {VOICE_ID, type VoiceRegistry} from "../services/voices";

export interface AppConfig {
    /** Optional shared secret. A speed bump, not authentication. */
    apiKey: string;
    maxTextChars: number;
}

export interface AppDeps {
    config: AppConfig;
    voices: VoiceRegistry;
    limiter: RateLimiter;
    blobs: BlobStore;
    tts: TtsClient;
    report: (entry: Record<string, unknown>) => Promise<void>;
}

const INSTALL_ID = /^[A-Za-z0-9-]{16,64}$/;
const AUDIO_FILE = /^[0-9a-f]{64}\.m4a$/;

class HttpError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number, field: string): string => {
    if (typeof value !== "string")
        throw new HttpError(400, `${field} required`);
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) throw new HttpError(400, `${field} required`);
    if (trimmed.length > max) throw new HttpError(400, `${field} too long`);
    return trimmed;
};

const handler =
    (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
    (req, res, next) => {
        fn(req, res).catch(next);
    };

const sendAudio = async (
    res: Response,
    blobs: BlobStore,
    path: string
): Promise<void> => {
    const found = await blobs.stream(path);
    if (!found) throw new HttpError(404, "gone");
    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader("Content-Length", String(found.size));
    // The name is a content hash: the bytes behind it never change.
    res.setHeader("Cache-Control", "private, max-age=86400, immutable");
    found.stream.pipe(res);
};

export const createApp = (deps: AppDeps) => {
    const {config} = deps;
    const app = express();
    app.disable("x-powered-by");
    app.use(express.json({limit: "8kb"}));

    app.get("/healthz", (_req, res) => {
        res.json({status: "ok"});
    });

    // Everything under /v1 is called by an install of the app.
    app.use("/v1", ((req, res, next) => {
        if (config.apiKey && req.header("x-api-key") !== config.apiKey) {
            res.status(401).json({error: "bad key"});
            return;
        }
        const installId = req.header("x-install-id") ?? "";
        if (!INSTALL_ID.test(installId)) {
            res.status(400).json({error: "bad install id"});
            return;
        }
        res.locals.installId = installId;
        next();
    }) as RequestHandler);

    /**
     * The personajes the app can pick from, with their personality text: the
     * app writes each reply in character before asking for it to be voiced.
     */
    app.get(
        "/v1/voices",
        handler(async (_req, res) => {
            res.json({voices: await deps.voices.list()});
        })
    );

    /**
     * Wakes the TTS service. The app calls this when the chat opens and does
     * not wait for it: a cold instance takes ~90 s to be ready, and starting
     * it while the user types hides most of that. The request is held open
     * until the TTS answers, because an instance that has responded is
     * throttled and would never finish a request made "in the background".
     */
    app.post(
        "/v1/warm",
        handler(async (_req, res) => {
            try {
                await deps.tts.warm?.();
            } catch {
                throw new HttpError(502, "tts unavailable");
            }
            res.status(204).end();
        })
    );

    /**
     * Text to speech in the chosen personaje's voice:
     *   POST /v1/speak {voice, text}
     * answers JSON with an audio URL, or the audio itself when the caller
     * sends `Accept: audio/mp4` (or `?format=audio`).
     */
    app.post(
        "/v1/speak",
        handler(async (req, res) => {
            const body = isRecord(req.body) ? req.body : {};
            const voiceId = text(body.voice, 41, "voice");
            if (!VOICE_ID.test(voiceId)) throw new HttpError(400, "bad voice");
            const voice = await deps.voices.get(voiceId);
            if (!voice) throw new HttpError(404, `unknown voice ${voiceId}`);

            const spoken = text(body.text, config.maxTextChars, "text");
            if (!checkSpeakable(spoken).ok)
                throw new HttpError(422, "text refused");

            const refusal = await deps.limiter.allow(res.locals.installId);
            if (refusal) throw new HttpError(429, refusal);

            const result = await deps.tts.synthesize(voice.id, spoken);
            const wantsAudio =
                req.query.format === "audio" ||
                req.header("accept")?.includes("audio/");
            if (wantsAudio) {
                await sendAudio(res, deps.blobs, result.path);
                return;
            }
            res.json({
                voice: voice.id,
                text: spoken,
                audioUrl: `/v1/${result.path}`,
                durationMs: result.durationMs,
                cached: result.cached,
            });
        })
    );

    app.get(
        "/v1/audio/:file",
        handler(async (req, res) => {
            const file = String(req.params.file);
            if (!AUDIO_FILE.test(file)) throw new HttpError(404, "gone");
            await sendAudio(res, deps.blobs, `audio/${file}`);
        })
    );

    app.post(
        "/v1/report",
        handler(async (req, res) => {
            const body = isRecord(req.body) ? req.body : {};
            await deps.report({
                at: Date.now(),
                install: String(res.locals.installId).slice(0, 8),
                speaker: text(body.speaker, 40, "speaker"),
                text: text(body.text, 400, "text"),
            });
            res.status(204).end();
        })
    );

    app.use((_req, res) => {
        res.status(404).json({error: "not found"});
    });

    app.use(
        (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
            if (error instanceof HttpError) {
                res.status(error.status).json({error: error.message});
                return;
            }
            // Malformed JSON from body-parser carries its own status.
            const status = (error as {status?: number}).status;
            if (status === 400 || status === 413) {
                res.status(status).json({error: "bad request"});
                return;
            }
            console.error("unhandled", error);
            res.status(500).json({error: "internal"});
        }
    );

    return app;
};
