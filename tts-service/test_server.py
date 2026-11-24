import numpy as np
import pytest
from fastapi.testclient import TestClient

import server
from test_tts_service import FakeBlobs, FakeEngine


@pytest.fixture()
def client(monkeypatch, tmp_path):
    blobs, engine = FakeBlobs(), FakeEngine()
    blobs.add_voice("cindy-sample")
    monkeypatch.setattr(server, "get_blobs", lambda: blobs)
    monkeypatch.setattr(server, "get_engine", lambda: engine)
    monkeypatch.setenv("VOICE_CACHE_DIR", str(tmp_path))
    return TestClient(server.app), engine


def test_synthesize_then_cache(client):
    c, engine = client
    body = {"voice": "cindy-sample", "text": "Hola"}
    first = c.post("/synthesize", json=body).json()
    second = c.post("/synthesize", json=body).json()
    assert first["cached"] is False and second["cached"] is True
    assert first["path"] == second["path"]
    assert len(engine.calls) == 1


@pytest.mark.parametrize(
    "voice,text,status",
    [("nadie-sample", "hola", 404), ("../x", "hola", 400), ("cindy-sample", " ", 400)],
)
def test_errors_map_to_http_status(client, voice, text, status):
    c, _ = client
    assert c.post("/synthesize", json={"voice": voice, "text": text}).status_code == status


def test_engine_failure_is_a_500_without_details(client, monkeypatch):
    c, engine = client

    def boom(*a, **k):
        raise RuntimeError("secret internals")

    engine.synthesize = boom
    r = c.post("/synthesize", json={"voice": "cindy-sample", "text": "hola"})
    assert r.status_code == 500 and "secret" not in r.text


def test_preload_loads_and_warms_the_model_before_serving(monkeypatch):
    calls = []

    class Engine:
        sample_rate = 24000

        def warmup(self):
            calls.append("warmup")

    monkeypatch.setenv("PRELOAD_MODEL", "1")
    monkeypatch.setattr(server, "get_engine", lambda: calls.append("load") or Engine())
    with TestClient(server.app) as c:
        assert calls == ["load", "warmup"]  # done before the first request
        assert c.get("/healthz").status_code == 200


def test_preload_failure_does_not_stop_the_service(monkeypatch):
    def boom():
        raise RuntimeError("no weights")

    monkeypatch.setenv("PRELOAD_MODEL", "1")
    monkeypatch.setattr(server, "get_engine", boom)
    with TestClient(server.app) as c:
        assert c.get("/healthz").status_code == 200


def test_ready_path_exists_for_the_gateway_warmup():
    assert TestClient(server.app).get("/ready").json() == {"status": "ok"}
