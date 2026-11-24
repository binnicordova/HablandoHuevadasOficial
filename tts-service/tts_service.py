"""Text in, a voice note in a stored voice out. No Firebase imports here.

The function in main.py is a thin shell around `synthesize`, so everything that
can go wrong (cache keys, voice lookup, encoding) is testable with fakes.

Cache: the output path is `audio/<sha256>.m4a`, hashed from the voice, the
exact versions (Storage generations) of its two sample files, the decoding
steps and the text. The same line in the same voice is voiced once, ever;
re-uploading a voice's sample changes the key and old audio is never reused.
"""

import hashlib
import io
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
import soundfile as sf

VOICE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{1,40}$")
MAX_TEXT_CHARS = 600


class BadRequest(ValueError):
    """The caller's fault: maps to a 4xx."""


class UnknownVoice(LookupError):
    """No such voice in Storage: maps to 404."""


@dataclass(frozen=True)
class Blob:
    data: bytes
    # Storage generation: changes every time the object is overwritten.
    version: str


class Blobs(Protocol):
    def get(self, path: str) -> Blob | None: ...

    def duration_ms(self, path: str) -> int | None:
        """Duration recorded on an existing audio object, else None."""
        ...

    def put_audio(self, path: str, data: bytes, duration_ms: int) -> None: ...


class Engine(Protocol):
    sample_rate: int

    def synthesize(self, text: str, ref_wav: Path, ref_text: str) -> np.ndarray:
        """Mono float32 samples in [-1, 1] at `sample_rate`."""
        ...


@dataclass(frozen=True)
class Result:
    path: str
    duration_ms: int
    cached: bool

    def as_json(self) -> dict:
        return {
            "path": self.path,
            "durationMs": self.duration_ms,
            "cached": self.cached,
        }


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def cache_key(voice: str, wav_version: str, txt_version: str, steps: int, text: str) -> str:
    raw = "\x1f".join([voice, wav_version, txt_version, str(steps), text])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _ffmpeg() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


def encode_m4a(samples: np.ndarray, sample_rate: int) -> bytes:
    """AAC in an .m4a, tagged as AI-generated (iOS and Android both play it)."""
    wav = io.BytesIO()
    sf.write(wav, samples, sample_rate, format="WAV", subtype="PCM_16")
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.m4a"
        subprocess.run(
            [
                _ffmpeg(), "-y", "-loglevel", "error", "-i", "pipe:0",
                "-c:a", "aac", "-b:a", "64k", "-ac", "1",
                "-metadata", "comment=Voz generada con IA / AI-generated voice",
                "-movflags", "+faststart", str(out),
            ],
            input=wav.getvalue(),
            check=True,
        )
        return out.read_bytes()


def synthesize(
    voice: str,
    text: str,
    blobs: Blobs,
    engine: Engine,
    steps: int,
    cache_dir: Path,
) -> Result:
    if not VOICE_ID.match(voice or ""):
        raise BadRequest("bad voice")
    text = normalize_text(text or "")
    if not text:
        raise BadRequest("text required")
    if len(text) > MAX_TEXT_CHARS:
        raise BadRequest("text too long")

    wav = blobs.get(f"voices/{voice}/sample.wav")
    transcript = blobs.get(f"voices/{voice}/sample.txt")
    if wav is None or transcript is None:
        raise UnknownVoice(voice)

    key = cache_key(voice, wav.version, transcript.version, steps, text)
    path = f"audio/{key}.m4a"
    known = blobs.duration_ms(path)
    if known is not None:
        return Result(path, known, cached=True)

    # The model reads the sample from disk: keep one copy per version.
    folder = cache_dir / voice / f"{wav.version}-{transcript.version}"
    folder.mkdir(parents=True, exist_ok=True)
    ref_wav = folder / "sample.wav"
    if not ref_wav.exists():
        ref_wav.write_bytes(wav.data)

    samples = engine.synthesize(text, ref_wav, transcript.data.decode("utf-8").strip())
    duration_ms = int(len(samples) / engine.sample_rate * 1000)
    blobs.put_audio(path, encode_m4a(samples, engine.sample_rate), duration_ms)
    return Result(path, duration_ms, cached=False)


def default_cache_dir() -> Path:
    # The function's filesystem is read-only except /tmp.
    return Path(os.environ.get("VOICE_CACHE_DIR", "/tmp/voices"))
