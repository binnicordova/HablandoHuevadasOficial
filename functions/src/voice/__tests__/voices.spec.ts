import {describe, expect, it} from "vitest";
import {StorageVoiceRegistry} from "../services/voices";
import {FakeBlobs, voiceBlobs} from "./fakes";

describe("StorageVoiceRegistry", () => {
    it("lists every voice folder that has both sample files", async () => {
        const registry = new StorageVoiceRegistry(voiceBlobs());
        const ids = (await registry.list()).map((v) => v.id);
        expect(ids).toEqual([
            "binnicordova-sample",
            "cindy-sample",
            "jorge-sample",
            "ricardo-sample",
        ]);
    });

    it("reads profile.json and defaults the rest from the folder name", async () => {
        const registry = new StorageVoiceRegistry(voiceBlobs());
        expect(await registry.get("ricardo-sample")).toMatchObject({
            slug: "ricardo",
            displayName: "Ricardo",
            persona: "El flaco sarcástico.",
        });
        expect(await registry.get("cindy-sample")).toMatchObject({
            slug: "cindy",
            displayName: "Cindy",
            language: "es",
        });
    });

    it("skips half-uploaded voices and ignores unrelated objects", async () => {
        const blobs = new FakeBlobs()
            .put("voices/half-sample/sample.wav")
            .put("voices/ok-sample/sample.wav")
            .put("voices/ok-sample/sample.txt")
            .put("voices/Bad_Name/sample.wav")
            .put("voices/Bad_Name/sample.txt")
            .put("audio/abc.m4a");
        const ids = (await new StorageVoiceRegistry(blobs).list()).map(
            (v) => v.id
        );
        expect(ids).toEqual(["ok-sample"]);
    });

    it("survives a broken profile.json", async () => {
        const blobs = voiceBlobs().put(
            "voices/cindy-sample/profile.json",
            "{oops"
        );
        const voice = await new StorageVoiceRegistry(blobs).get("cindy-sample");
        expect(voice?.displayName).toBe("Cindy");
    });

    it("picks up a new voice after the cache window without a redeploy", async () => {
        let now = 0;
        const blobs = voiceBlobs();
        const registry = new StorageVoiceRegistry(blobs, () => now);
        expect(await registry.get("new-sample")).toBeNull();
        blobs
            .put("voices/new-sample/sample.wav")
            .put("voices/new-sample/sample.txt");
        expect(await registry.get("new-sample")).toBeNull(); // still cached
        now = 61_000;
        expect(await registry.get("new-sample")).not.toBeNull();
    });

    it("rejects ids that could walk out of voices/", async () => {
        const registry = new StorageVoiceRegistry(voiceBlobs());
        expect(await registry.get("../audio")).toBeNull();
    });
});
