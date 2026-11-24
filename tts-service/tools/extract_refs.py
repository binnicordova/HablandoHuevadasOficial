"""Build the reference clips for each host from episodes you choose.

Cloning quality lives and dies on the reference clip: one speaker, no music,
no overlap, 5 to 12 seconds, natural speech. Picking the clip is therefore a
human step; this tool does the boring parts around it.

    # 1. Download an episode's audio and transcribe it with timestamps
    python tools/extract_refs.py fetch <youtube-url> --name ep1

    # 2. Read raw/ep1.segments.txt, find clean single-speaker lines, then cut
    python tools/extract_refs.py cut ep1 --speaker jorge --segment 41
    python tools/extract_refs.py cut ep1 --speaker ricardo --segment 87

Outputs refs/<speaker>.wav (24 kHz mono) and refs/<speaker>.txt (transcript).
Both stay out of git. Requires yt-dlp, ffmpeg and faster-whisper
(`pip install faster-whisper`). Only use material you are authorised to use.
"""

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
REFS = ROOT / "refs"
MIN_S, MAX_S = 4.0, 14.0


def fetch(url: str, name: str, section: str, model_name: str) -> None:
    RAW.mkdir(exist_ok=True)
    wav = RAW / f"{name}.wav"
    # Episodes run 100 minutes: a slice is plenty for two reference clips.
    cmd = ["yt-dlp", "-x", "--audio-format", "wav"]
    if section:
        cmd += ["--download-sections", f"*{section}"]
    cmd += ["--postprocessor-args", "ffmpeg:-ac 1 -ar 16000"]
    subprocess.run(
        [*cmd, "-o", str(RAW / f"{name}.%(ext)s"), url],
        check=True,
    )
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, compute_type="int8")
    segments, _ = model.transcribe(str(wav), language="es", vad_filter=True)
    rows = [
        {
            "i": i,
            "start": s.start,
            "end": s.end,
            "text": s.text.strip(),
            "logprob": s.avg_logprob,
        }
        for i, s in enumerate(segments)
    ]
    (RAW / f"{name}.segments.json").write_text(
        json.dumps(rows, ensure_ascii=False), encoding="utf-8"
    )
    lines = [
        f"{r['i']:>4}  {r['start']:8.1f}-{r['end']:8.1f}  "
        f"({r['end'] - r['start']:4.1f}s)  {r['text']}"
        for r in rows
        if MIN_S <= r["end"] - r["start"] <= MAX_S
    ]
    (RAW / f"{name}.segments.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(lines)} usable segments -> raw/{name}.segments.txt")


def cut(name: str, speaker: str, segment: int) -> None:
    rows = json.loads((RAW / f"{name}.segments.json").read_text("utf-8"))
    row = next(r for r in rows if r["i"] == segment)
    REFS.mkdir(exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-ss",
            str(row["start"]),
            "-to",
            str(row["end"]),
            "-i",
            str(RAW / f"{name}.wav"),
            "-ac",
            "1",
            "-ar",
            "24000",
            str(REFS / f"{speaker}.wav"),
        ],
        check=True,
    )
    (REFS / f"{speaker}.txt").write_text(row["text"], encoding="utf-8")
    print(f"refs/{speaker}.wav  <-  {row['text']!r}")
    print("Listen to it before trusting it: one voice, no music, no overlap.")


def main() -> None:
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch")
    f.add_argument("url")
    f.add_argument("--name", required=True)
    f.add_argument("--section", default="0:00-12:00", help="'' = whole file")
    f.add_argument("--model", default="large-v3")
    c = sub.add_parser("cut")
    c.add_argument("name")
    c.add_argument("--speaker", choices=["jorge", "ricardo"], required=True)
    c.add_argument("--segment", type=int, required=True)
    a = p.parse_args()
    if a.cmd == "fetch":
        fetch(a.url, a.name, a.section, a.model)
    else:
        cut(a.name, a.speaker, a.segment)


if __name__ == "__main__":
    main()
