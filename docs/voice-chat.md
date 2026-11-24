# Voice chat: talk to a personaje, hear it back

The user picks one or more **personajes** (Jorge, Ricardo, Cindy, Binni…), writes a
message, and each answers with a voice note in their own cloned voice.

```
 app ── 1. DeepSeek (in the app) writes the reply in the personaje's style
  │
  └─ 2. POST /v1/speak {voice, text} ──> voiceApi (Firebase function, functions/)
                                          ├─ checks, rate limits, cache lookup
                                          └──> tts-service (OmniVoice, Cloud Run, private)
                                                reads voices/<id>/sample.* from Storage,
                                                writes audio/<hash>.m4a to Storage
     3. GET /v1/audio/<hash>.m4a <──────── voiceApi streams it from Storage
```

| Piece | Where | Does |
|---|---|---|
| `src/chat/` | app | personaje picker, DeepSeek call, playback |
| `functions/src/voice/` | the one `functions/` codebase (TypeScript) | `voiceApi`: voices list, `/v1/speak`, audio, reports, rate limits |
| `tts-service/` | Cloud Run container (Python) | OmniVoice text to speech, content-addressed cache |
| Storage `voices/<id>/` | Firebase Storage | one folder per personaje |

## Why `tts-service/` is not inside `functions/`

A Firebase codebase has exactly one runtime, and `functions/` is Node. OmniVoice is
Python/PyTorch, and Cloud Functions has no GPU and caps the image, so it runs as a small
private Cloud Run service instead (same project, scale to zero, IAM-protected). The
gateway calls it with a Google ID token. Everything the app talks to is `voiceApi`.

## Voices: add a personaje without deploying anything

A voice is a folder in Storage:

```
voices/ricardo-sample/sample.wav     3 to 15 s of one clean voice, no music, no overlap
voices/ricardo-sample/sample.txt     exactly what is said in the sample
voices/ricardo-sample/profile.json   {"slug","displayName","persona","language"}  (optional)
```

```bash
cd functions
npm run upload-voice -- ricardo-sample ricardo.wav ricardo.txt \
    --name Ricardo --persona "El flaco sarcástico, siempre pica a Jorge."
```

The gateway lists `voices/` (cached 60 s), so the new personaje appears in the app's
picker and `persona` becomes its character in DeepSeek's prompt. Re-uploading a sample
changes the cache key, so old audio is never reused. Folders missing either sample file are
hidden. `voices/**` and `audio/**` are closed to clients by `storage.rules`.

Getting a good sample from an episode: `tts-service/tools/extract_refs.py` and
`pick_refs.py` (transcribe, cluster speakers, name them from who gets called). Listen to the
result: it is a guess. **Only upload voices you have the person's written consent for.**

## API (`voiceApi`)

Base URL: `https://us-east1-<project>.cloudfunctions.net/voiceApi`. Every `/v1` call needs
`X-Install-Id` (random id the app makes once, what the limits key on) and, if `API_KEY` is
set, `X-Api-Key`.

| | |
|---|---|
| `GET /v1/voices` | `{voices:[{id,slug,displayName,persona,language}]}` |
| `POST /v1/speak` `{voice,text}` | `{voice,text,audioUrl,durationMs,cached}`; send `Accept: audio/mp4` (or `?format=audio`) to get the bytes |
| `GET /v1/audio/<sha256>.m4a` | the voice note (immutable, content-hashed) |
| `POST /v1/report` `{speaker,text}` | stored in Firestore `reports` for a human |

Errors: 400 bad input, 404 unknown voice, 422 text the safety filter refuses, 429 rate
limit, 502/504 TTS down.

## DeepSeek runs in the app

`EXPO_PUBLIC_DEEPSEEK_API_KEY` is inlined into the JavaScript bundle at build time, so
**anyone with the app can extract it** and spend your credit. Mitigations: set a spend
limit on the key, rotate it if it leaks, never commit it (`.env` is git-ignored; for EAS
builds use `eas env:create`). The service never holds a key. If this ever matters, the
swap is one adapter: `deepseekScriptWriter` implements `ScriptWriter`, so a proxy
function can replace it without touching the rest.

The key pasted in a chat or a ticket is compromised by definition: rotate it.

## Run it locally

```bash
# 1. TTS (needs the venv: python3.11 -m venv venv && pip install -r requirements.txt)
cd tts-service
STORAGE_EMULATOR_HOST=http://127.0.0.1:9199 STORAGE_BUCKET=<project>.firebasestorage.app \
GOOGLE_CLOUD_PROJECT=<project> venv/bin/python -m uvicorn server:app --port 8090

# 2. Gateway + Storage + Firestore emulators (Firestore needs JDK 21+)
echo 'TTS_URL=http://127.0.0.1:8090/synthesize' > functions/.env.local
(cd functions && npm install && npm run build)
firebase emulators:start --only functions,firestore,storage

# 3. voices, then the app
(cd functions && FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 STORAGE_BUCKET=<project>.firebasestorage.app \
   npm run upload-voice -- jorge-sample jorge.wav jorge.txt --name Jorge)
EXPO_PUBLIC_VOICE_API_URL=http://10.0.2.2:5001/<project>/us-east1/voiceApi npx expo run:android
```

Run Metro **without `CI=1`** or it serves a stale bundle.

## Deploy (what was done for `hablandohuevadass`)

Always pass `--project`: this machine's default gcloud project is a different one.

```bash
P=hablandohuevadass

# 1. Firestore (rate limits, reports): once
gcloud services enable firestore.googleapis.com --project $P
firebase firestore:databases:create "(default)" --location us-east1 --project $P

# 2. The TTS container (private; scales to zero). First build ~25 min (2.4 GB of weights).
CLOUDSDK_BUILDS_TIMEOUT=3000 gcloud run deploy hh-tts --source tts-service \
  --project $P --region us-east1 --no-allow-unauthenticated --concurrency 1 \
  --cpu 8 --memory 16Gi --timeout 540 --min-instances 0 --max-instances 2 --cpu-boost \
  --set-env-vars STORAGE_BUCKET=<bucket>,OMNIVOICE_STEPS=8,PRELOAD_MODEL=1
# let the gateway call it (its service account is the default compute one)
gcloud run services add-iam-policy-binding hh-tts --project $P --region us-east1 \
  --member serviceAccount:<project-number>-compute@developer.gserviceaccount.com \
  --role roles/run.invoker

# 3. The gateway. functions/.env.<project> (git-ignored) must define every param:
#    TTS_URL=https://hh-tts-<number>.us-east1.run.app/synthesize
#    API_KEY=<random>   LIMIT_PER_MINUTE=6   LIMIT_PER_DAY=120   LIMIT_GLOBAL_PER_DAY=3000
firebase deploy --only functions:voiceApi,firestore:rules --project $P

# 4. Voices (the Storage rules close voices/** to clients, so use gcloud, not the app)
gcloud storage cp tts-service/voices_out/jorge-sample/* gs://<bucket>/voices/jorge-sample/ --project $P
```

`tts-service/.gcloudignore` matters: without it `gcloud` uploads the whole Python venv.

Expo / EAS (the app reads these at build time, and from `.env` in Expo Go):

```bash
eas env:create --name EXPO_PUBLIC_VOICE_API_URL  --value https://us-east1-<project>.cloudfunctions.net/voiceApi --environment production --environment preview --environment development --visibility plaintext
eas env:create --name EXPO_PUBLIC_VOICE_API_KEY  --value <the API_KEY above>   ... --visibility sensitive
eas env:create --name EXPO_PUBLIC_DEEPSEEK_API_KEY --value <deepseek key>      ... --visibility sensitive
```

`sensitive` hides the value in the dashboard and logs; the app bundle still contains it.

> **Gotcha:** on Cloud Run the path `/healthz` is reserved by Google's frontend (it answers
> 404 without reaching the container), so the TTS exposes `/ready` for the gateway's wake-up.

## Expo Go

The whole app runs in Expo Go (SDK 58): every native module it uses ships inside Expo Go.
`npx expo start --go`, scan the QR, with `EXPO_PUBLIC_*` values in `.env`. Only remote push
notifications are unavailable there (a platform limit since SDK 53); local ones work.

## Speed and cost (measured in production, CPU only)

| | |
|---|---|
| Cold start (new instance, model load) | ~80 to 100 s. The gateway wakes the TTS when the app opens the chat, so it overlaps with the user typing |
| Warm line, 8 vCPU | ~15 s for a 3 s line (4 vCPU: ~34 s) |
| Same line again, same voice | ~40 ms, no TTS (Storage hit) |

Thread count matters: PyTorch sized its pool from the host's cores, not the container's
quota, and a line took ~100 s. `engine.py` now reads the cgroup quota. A line costs about
$0.004 warm, $0.02 on a cold start. `--min-instances 1` removes cold starts and bills around
the clock (roughly $5/day at 8 vCPU / 16 GiB). A GPU (`--gpu 1 --gpu-type nvidia-l4`, in a
region that offers it, with quota) would make it near-instant.

## Licences, consent, content

- OmniVoice code is Apache-2.0 but its **weights are CC-BY-NC**: fine for a free app,
  re-check before any ads, subscription or paid tier.
- Written consent from every person whose voice is uploaded is a precondition; keep it
  outside the repo. The app says the voices are AI recreations (`COPY.chat.aiNotice`); keep
  that line true, and delete `voices/<id>/` if consent is withdrawn.
- Every note is tagged `AI-generated` in its m4a metadata.
- Two filters: the app checks the user's message (hate, sexual content, minors, self-harm with
  Peru's 113 line, prompt injection) and what DeepSeek wrote; the service re-checks every line
  before voicing it. Long-press a note to report it.
