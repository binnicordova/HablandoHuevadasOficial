import {createHash} from "node:crypto";
import {Readable} from "node:stream";
import type {AppDeps} from "../http/app";
import type {BlobStore} from "../services/blobs";
import {MemoryRateLimiter} from "../services/limits";
import type {TtsClient} from "../services/tts";
import {StorageVoiceRegistry} from "../services/voices";
import type {SynthesisResult} from "../types";

export class FakeBlobs implements BlobStore {
    readonly files = new Map<string, Buffer>();

    put(path: string, contents: string | Buffer = "x") {
        this.files.set(path, Buffer.from(contents));
        return this;
    }

    async list(prefix: string) {
        return [...this.files.keys()].filter((p) => p.startsWith(prefix));
    }

    async read(path: string) {
        return this.files.get(path) ?? null;
    }

    async stream(path: string) {
        const buffer = this.files.get(path);
        return buffer
            ? {stream: Readable.from([buffer]), size: buffer.length}
            : null;
    }
}

/** A blob store holding the four voices the product ships with. */
export const voiceBlobs = (): FakeBlobs => {
    const blobs = new FakeBlobs();
    for (const id of [
        "jorge-sample",
        "ricardo-sample",
        "binnicordova-sample",
        "cindy-sample",
    ]) {
        blobs.put(`voices/${id}/sample.wav`).put(`voices/${id}/sample.txt`);
    }
    blobs.put(
        "voices/ricardo-sample/profile.json",
        JSON.stringify({
            slug: "ricardo",
            displayName: "Ricardo",
            persona: "El flaco sarcástico.",
        })
    );
    return blobs;
};

export class FakeTts implements TtsClient {
    readonly calls: {voice: string; text: string}[] = [];
    warmed = 0;
    failWarm = false;

    constructor(readonly blobs: FakeBlobs) {}

    async warm() {
        this.warmed += 1;
        if (this.failWarm) throw new Error("tts asleep");
    }

    async synthesize(voice: string, text: string): Promise<SynthesisResult> {
        this.calls.push({voice, text});
        const hash = createHash("sha256")
            .update(`${voice}|${text}`)
            .digest("hex");
        const path = `audio/${hash}.m4a`;
        const cached = this.blobs.files.has(path);
        this.blobs.put(path, `audio:${voice}:${text}`);
        return {path, durationMs: 1500, cached};
    }
}

export const makeDeps = (overrides: Partial<AppDeps["config"]> = {}) => {
    const blobs = voiceBlobs();
    const tts = new FakeTts(blobs);
    const reports: Record<string, unknown>[] = [];
    const deps: AppDeps = {
        config: {apiKey: "", maxTextChars: 280, ...overrides},
        voices: new StorageVoiceRegistry(blobs),
        blobs,
        tts,
        limiter: new MemoryRateLimiter({
            perMinute: 2,
            perDay: 10,
            globalPerDay: 100,
        }),
        report: async (entry) => {
            reports.push(entry);
        },
    };
    return {deps, blobs, tts, reports};
};
