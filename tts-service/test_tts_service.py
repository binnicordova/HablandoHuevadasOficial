import subprocess
from pathlib import Path

import numpy as np
import pytest

import tts_service
from tts_service import Blob

SAMPLE_RATE = 24000


class FakeBlobs:
    def __init__(self):
        self.objects: dict[str, Blob] = {}
        self.durations: dict[str, int] = {}
        self.puts: list[str] = []

    def add_voice(self, voice: str, wav_version="1", txt_version="1"):
        self.objects[f"voices/{voice}/sample.wav"] = Blob(b"RIFFfake", wav_version)
        self.objects[f"voices/{voice}/sample.txt"] = Blob(
            "  Hola, esto es una prueba.  ".encode(), txt_version
        )

    def get(self, path):
        return self.objects.get(path)

    def duration_ms(self, path):
        return self.durations.get(path)

    def put_audio(self, path, data, duration_ms):
        self.puts.append(path)
        self.durations[path] = duration_ms
        self.objects[path] = Blob(data, "1")


class FakeEngine:
    sample_rate = SAMPLE_RATE

    def __init__(self):
        self.calls: list[tuple[str, str]] = []

    def synthesize(self, text, ref_wav: Path, ref_text):
        assert ref_wav.exists()
        self.calls.append((text, ref_text))
        t = np.arange(SAMPLE_RATE) / SAMPLE_RATE
        return (0.2 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)  # 1 s


@pytest.fixture()
def env(tmp_path):
    blobs, engine = FakeBlobs(), FakeEngine()
    blobs.add_voice("ricardo-sample")
    return blobs, engine, tmp_path


def run(env, voice="ricardo-sample", text="Hola causa", steps=8):
    blobs, engine, cache = env
    return tts_service.synthesize(voice, text, blobs, engine, steps, cache)


def test_synthesizes_encodes_and_stores_a_playable_m4a(env):
    blobs, engine, _ = env
    result = run(env)
    assert result.cached is False
    assert result.duration_ms == 1000
    assert result.path.startswith("audio/") and result.path.endswith(".m4a")
    assert engine.calls == [("Hola causa", "Hola, esto es una prueba.")]

    out = Path(env[2]) / "out.m4a"
    out.write_bytes(blobs.objects[result.path].data)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_name",
         "-of", "default=nw=1:nk=1", str(out)],
        capture_output=True, text=True, check=True,
    )
    assert probe.stdout.strip() == "aac"


def test_same_line_same_voice_is_voiced_once(env):
    _, engine, _ = env
    first, second = run(env), run(env, text="  Hola   causa ")
    assert second.cached is True
    assert second.path == first.path
    assert second.duration_ms == first.duration_ms
    assert len(engine.calls) == 1


def test_a_new_sample_version_never_reuses_old_audio(env):
    blobs, engine, _ = env
    first = run(env)
    blobs.add_voice("ricardo-sample", wav_version="2")  # sample re-uploaded
    second = run(env)
    assert second.path != first.path and second.cached is False
    assert len(engine.calls) == 2


def test_other_voice_or_text_or_steps_is_a_different_object(env):
    blobs, _, _ = env
    blobs.add_voice("jorge-sample")
    paths = {
        run(env).path,
        run(env, voice="jorge-sample").path,
        run(env, text="Otra cosa").path,
        run(env, steps=16).path,
    }
    assert len(paths) == 4


@pytest.mark.parametrize(
    "voice,text",
    [("../etc", "hola"), ("", "hola"), ("ricardo-sample", "   "),
     ("ricardo-sample", "a" * 601), ("Ricardo_Sample", "hola")],
)
def test_bad_requests(env, voice, text):
    with pytest.raises(tts_service.BadRequest):
        run(env, voice=voice, text=text)


def test_unknown_voice_and_half_uploaded_voice(env):
    blobs, _, _ = env
    with pytest.raises(tts_service.UnknownVoice):
        run(env, voice="nadie-sample")
    blobs.add_voice("half-sample")
    del blobs.objects["voices/half-sample/sample.txt"]
    with pytest.raises(tts_service.UnknownVoice):
        run(env, voice="half-sample")


def test_result_json_matches_what_the_gateway_expects(env):
    body = run(env).as_json()
    assert set(body) == {"path", "durationMs", "cached"}
    assert len(body["path"]) == len("audio/") + 64 + len(".m4a")


def test_cpu_quota_is_read_from_cgroup_not_from_the_host():
    from engine import parse_cpu_max

    assert parse_cpu_max("400000 100000") == 4
    assert parse_cpu_max("800000 100000\n") == 8
    assert parse_cpu_max("150000 100000") == 2  # rounds up
    assert parse_cpu_max("max 100000") is None
