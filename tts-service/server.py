"""Private text-to-speech service: `POST /synthesize` -> a voice note in Storage.

Called only by the `voiceApi` Firebase function (functions/src/voice), never by
the app. Deployed as a Cloud Run service with IAM (no public access): the
function presents a Google ID token for this service's URL.

    POST /synthesize {"voice": "ricardo-sample", "text": "..."}
    -> {"path": "audio/<sha256>.m4a", "durationMs": 4200, "cached": false}

Voices are read from Storage (`voices/<id>/sample.wav` + `sample.txt`) on
demand, so a new voice needs no redeploy of anything.
"""

import asyncio
import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import engine as engine_module
import tts_service

log = logging.getLogger("tts")
@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the model and run one warm-up synthesis BEFORE the port opens.
    # Startup gets full CPU (Cloud Run's startup boost) and is not billed to
    # any request, so a cold request no longer pays ~80 s of model setup. Cloud
    # Run holds incoming requests until the container is ready.
    if os.environ.get("PRELOAD_MODEL") == "1":
        try:
            engine = await asyncio.to_thread(get_engine)
            await asyncio.to_thread(engine.warmup)
            log.info("model ready")
        except Exception:
            log.exception("preload failed; the first request will retry")
    yield


app = FastAPI(title="HH tts", docs_url=None, redoc_url=None, lifespan=lifespan)

_engine: engine_module.OmniVoiceEngine | None = None
# One synthesis at a time per instance: the model owns every core while it
# runs. Deploy with --concurrency=1 so Cloud Run never queues two here.
_lock = threading.Lock()


def get_engine() -> engine_module.OmniVoiceEngine:
    """Loaded on the first request of an instance, then kept."""
    global _engine
    if _engine is None:
        log.info("loading OmniVoice")
        _engine = engine_module.OmniVoiceEngine()
    return _engine


class GcsBlobs:
    def __init__(self, bucket) -> None:
        self._bucket = bucket

    def get(self, path: str):
        blob = self._bucket.get_blob(path)
        if blob is None:
            return None
        return tts_service.Blob(blob.download_as_bytes(), str(blob.generation))

    def duration_ms(self, path: str):
        blob = self._bucket.get_blob(path)
        if blob is None or not blob.metadata:
            return None
        value = blob.metadata.get("durationMs")
        return int(value) if value is not None else None

    def put_audio(self, path: str, data: bytes, duration_ms: int) -> None:
        blob = self._bucket.blob(path)
        blob.metadata = {"durationMs": str(duration_ms)}
        blob.upload_from_string(data, content_type="audio/mp4")


def get_blobs() -> GcsBlobs:
    from google.cloud import storage

    # STORAGE_EMULATOR_HOST is honoured by the client, so the same code runs
    # against the Firebase Storage emulator.
    return GcsBlobs(storage.Client().bucket(os.environ["STORAGE_BUCKET"]))


class SynthesizeRequest(BaseModel):
    voice: str
    text: str


@app.get("/ready")
@app.get("/healthz")
def ready() -> dict[str, str]:
    # Not /healthz for the gateway: Cloud Run's frontend reserves that path
    # and answers 404 itself, so a request there never wakes the container.
    return {"status": "ok"}


@app.post("/synthesize")
def synthesize(request: SynthesizeRequest) -> dict:
    try:
        with _lock:
            result = tts_service.synthesize(
                voice=request.voice,
                text=request.text,
                blobs=get_blobs(),
                engine=get_engine(),
                steps=engine_module.steps(),
                cache_dir=tts_service.default_cache_dir(),
            )
    except tts_service.BadRequest as error:
        raise HTTPException(400, str(error)) from error
    except tts_service.UnknownVoice as error:
        raise HTTPException(404, f"unknown voice {error}") from error
    except Exception:
        log.exception("synthesis failed")
        raise HTTPException(500, "synthesis failed") from None
    log.info("synthesized voice=%s cached=%s", request.voice, result.cached)
    return result.as_json()
