"""Build one voice sample from a clip where that person is (mostly) talking.

    python tools/make_sample.py raw/jorge_src.wav jorge-sample --name Jorge \
        --persona "Achorado, bromista."

Steps: transcribe with Whisper, embed every segment with a speaker model,
split the voices into two clusters, keep the one that talks the most (the
person you cut the clip for), and cut the best 6 to 14 s run of that voice:
close to 10 s, cleanly transcribed, no other speaker in the middle.

Writes voices/<id>/{sample.wav, sample.txt, profile.json} under ./voices_out/,
ready for `npm run upload-voice`. It is a GUESS about who is speaking: listen
to sample.wav before uploading it anywhere. Only use voices you have the
person's written consent for.
"""

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MIN_RUN_S, MAX_RUN_S, IDEAL_S = 6.0, 14.0, 10.0
MAX_GAP_S = 0.7


def to_16k(src: Path, dst: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "16000", str(dst)],
        check=True,
    )


def transcribe(wav16: Path) -> list[dict]:
    from faster_whisper import WhisperModel

    model = WhisperModel("large-v3", compute_type="int8")
    segments, _ = model.transcribe(str(wav16), language="es", vad_filter=True)
    return [
        {"start": s.start, "end": s.end, "text": s.text.strip(), "logprob": s.avg_logprob}
        for s in segments
        if s.text.strip()
    ]


def embed(wav16: Path, rows: list[dict]) -> np.ndarray:
    import torch
    import torchaudio
    from speechbrain.inference.speaker import EncoderClassifier

    model = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir=str(ROOT / "raw" / "ecapa"),
    )
    signal, sr = torchaudio.load(str(wav16))
    out = []
    for r in rows:
        chunk = signal[:, int(r["start"] * sr) : int(r["end"] * sr)]
        if chunk.shape[1] < sr // 2:  # under half a second: too short to embed
            chunk = torch.nn.functional.pad(chunk, (0, sr // 2 - chunk.shape[1]))
        with torch.no_grad():
            out.append(model.encode_batch(chunk).squeeze().cpu().numpy())
    e = np.stack(out)
    return e / np.linalg.norm(e, axis=1, keepdims=True)


def dominant_labels(emb: np.ndarray, rows: list[dict]) -> np.ndarray:
    """1 where the segment belongs to the voice that talks the most."""
    talk = sum(r["end"] - r["start"] for r in rows)
    if len(rows) < 6 or talk < 20:
        return np.ones(len(rows), dtype=int)  # too little to tell voices apart
    from sklearn.cluster import AgglomerativeClustering

    labels = AgglomerativeClustering(n_clusters=2, metric="cosine", linkage="average").fit_predict(emb)
    centroids = [emb[labels == c].mean(axis=0) for c in (0, 1)]
    centroids = [c / np.linalg.norm(c) for c in centroids]
    if float(centroids[0] @ centroids[1]) > 0.7:
        # The two "clusters" are the same voice: a monologue forced into two.
        return np.ones(len(rows), dtype=int)
    seconds = [sum(r["end"] - r["start"] for r, l in zip(rows, labels) if l == c) for c in (0, 1)]
    return (labels == int(np.argmax(seconds))).astype(int)


def runs(rows: list[dict], mine: np.ndarray) -> list[list[dict]]:
    """Consecutive segments of the dominant voice, split at gaps or others."""
    out: list[list[dict]] = []
    cur: list[dict] = []
    for r, m in zip(rows, mine):
        if m and cur and r["start"] - cur[-1]["end"] <= MAX_GAP_S:
            cur.append(r)
        elif m:
            if cur:
                out.append(cur)
            cur = [r]
        else:
            if cur:
                out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def windows(run: list[dict]) -> list[list[dict]]:
    """Every contiguous slice of a run that is 6 to 14 s long."""
    found = []
    for i in range(len(run)):
        for j in range(i, len(run)):
            length = run[j]["end"] - run[i]["start"]
            if length > MAX_RUN_S:
                break
            if length >= MIN_RUN_S:
                found.append(run[i : j + 1])
    return found


def score(window: list[dict]) -> float:
    length = window[-1]["end"] - window[0]["start"]
    logprob = sum(r["logprob"] for r in window) / len(window)
    text = " ".join(r["text"] for r in window)
    # Spelled-out codes, digits and acronyms are where ASR is least reliable,
    # and the transcript must match the audio word for word.
    risky = 1.0 if re.search(r"\d|\b[A-Z]{3,}\b", text) else 0.0
    return logprob - 0.08 * abs(length - IDEAL_S) - risky


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("voice_id")
    ap.add_argument("--name")
    ap.add_argument("--persona", default="")
    a = ap.parse_args()

    slug = a.voice_id.removesuffix("-sample")
    out_dir = ROOT / "voices_out" / a.voice_id
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        wav16 = Path(tmp) / "src16.wav"
        to_16k(a.src, wav16)
        rows = transcribe(wav16)
        print(f"{len(rows)} segments")
        for r in rows:
            print(f"  {r['start']:6.1f}-{r['end']:6.1f}  lp={r['logprob']:.2f}  {r['text']}")
        emb = embed(wav16, rows)

    mine = dominant_labels(emb, rows)
    cands = [w for run in runs(rows, mine) for w in windows(run)]
    if not cands:
        # A short clip (e.g. 12 s) may hold no 6 s run of one voice: take the
        # whole dominant stretch instead and say so.
        # Every segment between the first and last dominant one, so the text
        # always covers the whole audio span that gets cut.
        dom = [i for i, m in enumerate(mine) if m]
        cands = [rows[dom[0] : dom[-1] + 1]]
        print("WARNING: no 6 s single-voice run; using the whole dominant span")
    best = max(cands, key=score)
    start, end = best[0]["start"], best[-1]["end"]
    text = " ".join(r["text"] for r in best)

    wav = out_dir / "sample.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.2f}", "-to", f"{end:.2f}",
         "-i", str(a.src), "-ac", "1", "-ar", "24000", str(wav)],
        check=True,
    )
    (out_dir / "sample.txt").write_text(text, encoding="utf-8")
    profile = {
        "slug": slug,
        "displayName": a.name or slug.capitalize(),
        "language": "es",
        **({"persona": a.persona} if a.persona else {}),
    }
    (out_dir / "profile.json").write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n-> {wav}  [{start:.1f}s-{end:.1f}s, {end - start:.1f}s]\n   {text!r}")
    print("Listen to it before using it.")


if __name__ == "__main__":
    main()
