#!/usr/bin/env node
/**
 * Adds or replaces a voice in Storage. No deploy needed: the gateway lists
 * `voices/` and the TTS function reads the sample on demand.
 *
 *   npm run upload-voice -- <id> <sample.wav> <transcript.txt|"text"> \
 *       [--name Ricardo] [--slug ricardo] [--persona "..."] [--lang es]
 *
 *   npm run upload-voice -- ricardo-sample ricardo.wav ricardo.txt \
 *       --name Ricardo --persona "Sarcástico, flaco, siempre pica a Jorge."
 *
 * Auth: Application Default Credentials (`gcloud auth application-default
 * login`) or GOOGLE_APPLICATION_CREDENTIALS. Against the emulator set
 * FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 and STORAGE_BUCKET.
 *
 * The sample should be 3 to 15 s of one clean voice, no music, no overlap, and
 * the transcript must say exactly what is in it. Only upload voices you have
 * the person's written consent to use.
 */
import {existsSync, readFileSync} from "node:fs";
import {parseArgs} from "node:util";
import {applicationDefault, initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";

const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {
        name: {type: "string"},
        slug: {type: "string"},
        persona: {type: "string"},
        lang: {type: "string", default: "es"},
        bucket: {type: "string"},
    },
});

const [id, wavPath, transcript] = positionals;
if (!id || !wavPath || !transcript) {
    console.error(
        'usage: upload-voice <id> <sample.wav> <transcript.txt|"text"> [--name] [--slug] [--persona] [--lang]'
    );
    process.exit(2);
}
if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) {
    console.error(
        "id must be lowercase letters, digits and dashes, e.g. cindy-sample"
    );
    process.exit(2);
}
if (!existsSync(wavPath)) {
    console.error(`no such file: ${wavPath}`);
    process.exit(2);
}

const bucketName =
    values.bucket ??
    process.env.STORAGE_BUCKET ??
    "hablandohuevadass.firebasestorage.app";
// The Storage emulator needs no credentials; the real bucket does.
const emulator = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
initializeApp({
    ...(emulator ? {} : {credential: applicationDefault()}),
    storageBucket: bucketName,
});
const bucket = getStorage().bucket();

const text = (
    existsSync(transcript) ? readFileSync(transcript, "utf8") : transcript
).trim();
const slug = (values.slug ?? id.replace(/-sample$/, "")).toLowerCase();
const profile = {
    slug,
    displayName: values.name ?? slug.charAt(0).toUpperCase() + slug.slice(1),
    ...(values.persona ? {persona: values.persona} : {}),
    language: values.lang,
};

await bucket
    .file(`voices/${id}/sample.wav`)
    .save(readFileSync(wavPath), {contentType: "audio/wav"});
await bucket
    .file(`voices/${id}/sample.txt`)
    .save(text, {contentType: "text/plain; charset=utf-8"});
await bucket
    .file(`voices/${id}/profile.json`)
    .save(JSON.stringify(profile, null, 2), {
        contentType: "application/json",
    });
console.log(`uploaded voices/${id}/ to ${bucketName}`, profile);
