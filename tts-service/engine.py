"""OmniVoice (k2-fsa), zero-shot cloning from a sample and its transcript.

API per https://pypi.org/project/omnivoice/ (checked 2026-11): `generate`
returns a list of float arrays at 24 kHz. The weights are CC-BY-NC: fine for a
free app, to be revisited before any ads or paid tier.

Speed is the catch. Functions have no GPU, so this runs on CPU: measured on an
M1 it is ~3.5x real time at 8 steps, ~13x at the default 32. Hence the default
of 8 and the content-addressed cache in tts_service.
"""

import math
import os
from pathlib import Path

import numpy as np
import soundfile as sf

DEFAULT_STEPS = 8


def parse_cpu_max(text: str) -> int | None:
    """vCPUs from a cgroup v2 `cpu.max` ("400000 100000" -> 4, "max 100000" -> None)."""
    quota, period = text.split()
    if quota == "max":
        return None
    return max(1, math.ceil(int(quota) / int(period)))


def cpu_limit() -> int:
    """The container's CPU quota, not the host's core count.

    PyTorch sizes its thread pool from the cores it can see. In Cloud Run that
    is the whole host (dozens of cores) against a quota of a few vCPUs, and
    the oversubscription made a 3 s line take ~100 s instead of ~15 s.
    """
    try:
        limit = parse_cpu_max(Path("/sys/fs/cgroup/cpu.max").read_text())
    except (OSError, ValueError):
        limit = None
    return limit or os.cpu_count() or 1


def steps() -> int:
    return int(os.environ.get("OMNIVOICE_STEPS", DEFAULT_STEPS))


def _device() -> str:
    import torch

    if os.environ.get("OMNIVOICE_DEVICE"):
        return os.environ["OMNIVOICE_DEVICE"]
    if torch.cuda.is_available():
        return "cuda:0"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class OmniVoiceEngine:
    sample_rate = 24000

    def __init__(self) -> None:
        import torch
        from omnivoice import OmniVoice

        torch.set_num_threads(int(os.environ.get("TORCH_THREADS") or cpu_limit()))
        device = _device()
        self._model = OmniVoice.from_pretrained(
            "k2-fsa/OmniVoice",
            device_map=device,
            dtype=torch.float16 if device.startswith("cuda") else torch.float32,
        )
        self._steps = steps()

    def warmup(self) -> None:
        """One throwaway synthesis. The first `generate` after loading takes ~60 s
        (lazy initialisation) against ~15 s afterwards, so it is paid here, at
        container start, with a synthetic reference instead of a real voice."""
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            ref = Path(tmp) / "ref.wav"
            t = np.arange(self.sample_rate * 3) / self.sample_rate
            sf.write(ref, (0.1 * np.sin(2 * np.pi * 180 * t)).astype("float32"), self.sample_rate)
            self.synthesize("Hola, ya estoy listo para hablar.", ref, "Hola, esto es una prueba.")

    def synthesize(self, text: str, ref_wav: Path, ref_text: str) -> np.ndarray:
        audio = self._model.generate(
            text=text,
            ref_audio=str(ref_wav),
            ref_text=ref_text,
            num_step=self._steps,
        )
        return np.asarray(audio[0], dtype=np.float32)
