"""Suggest reference clips per host by clustering who is speaking.

    python tools/pick_refs.py ep1

Reads raw/ep1.wav and raw/ep1.segments.json (see extract_refs.py), embeds each
usable segment with a speaker model, clusters the voices, and names the two
biggest clusters by who gets *called* in the transcript: a segment that says
"Ricardo, ..." is almost always spoken by someone who is not Ricardo.

Writes the best candidates to refs_candidates/<host>_<n>.wav (+ .txt) and
copies the top one of each to refs/. This is a guess, not a verdict: LISTEN to
refs/*.wav before trusting it, and swap in another candidate if it is wrong.
"""

import argparse
import json
import re
import shutil
import subprocess
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW, REFS, CANDS = ROOT / "raw", ROOT / "refs", ROOT / "refs_candidates"
MIN_S, MAX_S, TOP = 5.0, 12.0, 4
NAMES = {"jorge": r"\bjorg(e|ito|ie)\b", "ricardo": r"\bricard(o|ito)\b|\brichi\b"}


def embed(wav: Path, rows: list[dict]) -> np.ndarray:
    import torch
    import torchaudio
    from speechbrain.inference.speaker import EncoderClassifier

    model = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir=str(ROOT / "raw" / "ecapa"),
    )
    signal, sr = torchaudio.load(str(wav))
    if sr != 16000:
        signal = torchaudio.functional.resample(signal, sr, 16000)
        sr = 16000
    out = []
    for r in rows:
        chunk = signal[:, int(r["start"] * sr) : int(r["end"] * sr)]
        with torch.no_grad():
            out.append(model.encode_batch(chunk).squeeze().cpu().numpy())
    e = np.stack(out)
    return e / np.linalg.norm(e, axis=1, keepdims=True)


def main(name: str, clusters: int) -> None:
    from sklearn.cluster import AgglomerativeClustering

    rows = json.loads((RAW / f"{name}.segments.json").read_text("utf-8"))
    usable = [r for r in rows if MIN_S <= r["end"] - r["start"] <= MAX_S]
    emb = embed(RAW / f"{name}.wav", usable)
    labels = AgglomerativeClustering(
        n_clusters=clusters, metric="cosine", linkage="average"
    ).fit_predict(emb)

    # Talking time per cluster, over every segment, not only the usable ones.
    seconds = Counter()
    for r, label in zip(usable, labels):
        seconds[label] += r["end"] - r["start"]
    big = [c for c, _ in seconds.most_common(2)]

    # Who is addressed in each cluster's lines tells us who they are not.
    called = {c: Counter() for c in big}
    for r, label in zip(usable, labels):
        if label in called:
            for host, pattern in NAMES.items():
                if re.search(pattern, r["text"].lower()):
                    called[label][host] += 1
    print("talk seconds:", {int(c): round(s) for c, s in seconds.items()})
    print("names said inside each cluster:", {int(c): dict(v) for c, v in called.items()})

    a, b = big
    # Cluster a is "Jorge" if it says "Ricardo" more than b does.
    jorge, ricardo = (a, b) if called[a]["ricardo"] + called[b]["jorge"] >= (
        called[a]["jorge"] + called[b]["ricardo"]
    ) else (b, a)
    mapping = {"jorge": jorge, "ricardo": ricardo}

    shutil.rmtree(CANDS, ignore_errors=True)
    CANDS.mkdir()
    REFS.mkdir(exist_ok=True)
    for host, cluster in mapping.items():
        members = [
            (i, r) for i, (r, l) in enumerate(zip(usable, labels)) if l == cluster
        ]
        centroid = emb[[i for i, _ in members]].mean(axis=0)
        # Closest to the centroid, then cleanest transcription, 7-10s ideal.
        def score(item):
            i, r = item
            sim = float(emb[i] @ centroid)
            length = r["end"] - r["start"]
            return sim + 0.3 * r.get("logprob", -1) - 0.02 * abs(length - 8.5)

        best = sorted(members, key=score, reverse=True)[:TOP]
        for n, (_, r) in enumerate(best):
            target = CANDS / f"{host}_{n}.wav"
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(r["start"]),
                 "-to", str(r["end"]), "-i", str(RAW / f"{name}.wav"),
                 "-ac", "1", "-ar", "24000", str(target)],
                check=True,
            )
            target.with_suffix(".txt").write_text(r["text"], encoding="utf-8")
            print(f"{host}_{n}  {r['start']:7.1f}s  {r['text']}")
        shutil.copy(CANDS / f"{host}_0.wav", REFS / f"{host}.wav")
        shutil.copy(CANDS / f"{host}_0.txt", REFS / f"{host}.txt")
    print("\nrefs/ now holds a GUESS. Listen to refs/*.wav; swap from refs_candidates/.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("--clusters", type=int, default=3)
    a = ap.parse_args()
    main(a.name, a.clusters)
