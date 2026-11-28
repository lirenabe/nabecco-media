#!/usr/bin/env python3
"""Weekly / kouhou news video: Google TTS + still slides + burned-in captions."""

from __future__ import annotations

import argparse
import base64
import json
import re
import shutil
import subprocess
import urllib.error
import urllib.request
import xml.sax.saxutils
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parents[1]
DATA = REPO / "data" / "video"
ENV_PATH = REPO / ".env"
TTS_READINGS_PATH = REPO / "dict" / "tts-akita-municipalities.yml"

def _require_bin(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"{name} not found in PATH (brew install ffmpeg)")
    return path


FFMPEG = _require_bin("ffmpeg")
FFPROBE = _require_bin("ffprobe")

VOICE_NAME = "ja-JP-Neural2-B"
VOICE_LANG = "ja-JP"
FPS = 25
GAP_SEC = 0.85  # pause between sections

# Japanese-capable fonts (first existing wins). Override with NABECCO_VIDEO_FONT.
_FONT_CANDIDATES = (
    # macOS
    "/System/Library/Fonts/ヒラギノ角ゴシック W4.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    # Linux (Noto / IPAex — package names vary by distro)
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
    # Windows
    "C:/Windows/Fonts/msgothic.ttc",
    "C:/Windows/Fonts/meiryo.ttc",
    "C:/Windows/Fonts/YuGothM.ttc",
)


def _env_value(key: str) -> str | None:
    if not ENV_PATH.is_file():
        return None
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == key:
            val = v.strip().strip('"').strip("'")
            return val or None
    return None


def resolve_font() -> str:
    override = _env_value("NABECCO_VIDEO_FONT")
    if override:
        p = Path(override)
        if not p.is_file():
            raise SystemExit(f"NABECCO_VIDEO_FONT not found: {override}")
        return str(p)
    for cand in _FONT_CANDIDATES:
        if Path(cand).is_file():
            return cand
    raise SystemExit(
        "No Japanese font found. Install a CJK font or set NABECCO_VIDEO_FONT "
        "in .env to a .ttf/.ttc/.otf path."
    )


FONT = resolve_font()


@dataclass
class Section:
    heading: str
    body: str

    @property
    def speak_text(self) -> str:
        return self.body.strip()


def load_api_key() -> str:
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == "GOOGLE_TTS_API_KEY":
            key = v.strip().strip('"').strip("'")
            if not key:
                raise SystemExit("GOOGLE_TTS_API_KEY is empty in .env")
            return key
    raise SystemExit("GOOGLE_TTS_API_KEY not found in .env")


def parse_script(path: Path) -> list[Section]:
    raw = path.read_text(encoding="utf-8").strip()
    chunks = re.split(r"\n---\n", raw)
    sections: list[Section] = []
    for chunk in chunks:
        lines = [ln.rstrip() for ln in chunk.strip().splitlines()]
        if not lines:
            continue
        heading = "なべっこニュース"
        body_lines = lines
        if lines[0].startswith("# "):
            heading = lines[0][2:].strip()
            body_lines = lines[1:]
        body = "\n".join(body_lines).strip()
        if body:
            sections.append(Section(heading=heading, body=body))
    if not sections:
        raise SystemExit(f"no sections in {path}")
    return sections


def load_tts_readings(path: Path = TTS_READINGS_PATH) -> dict[str, str]:
    """Load surface→yomi map from dict/tts-akita-municipalities.yml (minimal YAML)."""
    if not path.is_file():
        return {}
    readings: dict[str, str] = {}
    in_readings = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.rstrip() == "readings:":
            in_readings = True
            continue
        if not in_readings:
            continue
        if line[0] not in " \t":
            break
        raw = line.strip()
        if ":" not in raw:
            continue
        surface, yomi = raw.split(":", 1)
        surface = surface.strip().strip("\"'")
        yomi = yomi.strip().strip("\"'")
        if surface and yomi:
            readings[surface] = yomi
    return readings


def ssml_escape_with_readings(text: str, readings: dict[str, str]) -> str:
    """Escape text for SSML; wrap known municipality names in <sub alias=\"yomi\">."""
    if not readings:
        return xml.sax.saxutils.escape(text)
    surfaces = sorted(readings.keys(), key=len, reverse=True)
    pattern = re.compile("|".join(re.escape(s) for s in surfaces))
    parts: list[str] = []
    last = 0
    for m in pattern.finditer(text):
        if m.start() > last:
            parts.append(xml.sax.saxutils.escape(text[last : m.start()]))
        surface = m.group(0)
        yomi = readings[surface]
        parts.append(
            f'<sub alias="{xml.sax.saxutils.escape(yomi)}">'
            f"{xml.sax.saxutils.escape(surface)}</sub>"
        )
        last = m.end()
    if last < len(text):
        parts.append(xml.sax.saxutils.escape(text[last:]))
    return "".join(parts)


def synthesize(
    text: str,
    api_key: str,
    out_mp3: Path,
    readings: dict[str, str] | None = None,
) -> None:
    if readings is None:
        readings = load_tts_readings()
    # Slight pause after sentences via SSML breaks on blank-ish boundaries
    sentences = [s.strip() for s in re.split(r"(?<=[。！？])", text) if s.strip()]
    parts: list[str] = []
    for i, s in enumerate(sentences):
        parts.append(ssml_escape_with_readings(s, readings))
        if i < len(sentences) - 1:
            parts.append('<break time="650ms"/>')
    ssml = "<speak>" + "".join(parts) + "</speak>"
    body = {
        "input": {"ssml": ssml},
        "voice": {"languageCode": VOICE_LANG, "name": VOICE_NAME},
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": 0.96,
            "pitch": -1.0,
        },
    }
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:800]
        raise SystemExit(f"TTS HTTP {e.code}: {detail}") from e
    audio_b64 = payload.get("audioContent")
    if not audio_b64:
        raise SystemExit("TTS response missing audioContent")
    out_mp3.write_bytes(base64.b64decode(audio_b64))


def make_silence(path: Path, seconds: float) -> None:
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=24000:cl=mono",
            "-t",
            f"{seconds:.3f}",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "64k",
            str(path),
        ],
        check=True,
        capture_output=True,
    )


def audio_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            FFPROBE,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def concat_audio(parts: list[Path], out: Path) -> None:
    list_path = out.with_suffix(".txt")
    list_path.write_text(
        "".join(f"file '{p.resolve()}'\n" for p in parts),
        encoding="utf-8",
    )
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            str(out),
        ],
        check=True,
        capture_output=True,
    )


def cover_fit(src: Image.Image, box_w: int, box_h: int) -> Image.Image:
    """Center-crop to fill box (cover)."""
    sw, sh = src.size
    scale = max(box_w / sw, box_h / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - box_w) // 2
    top = (nh - box_h) // 2
    return resized.crop((left, top, left + box_w, top + box_h))


def wrap_heading(text: str, max_chars: int = 14) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    # prefer break at space / middle dot / ・
    for sep in (" ", "　", "・", "／"):
        if sep in text:
            parts = text.split(sep)
            lines: list[str] = []
            cur = ""
            for p in parts:
                cand = p if not cur else cur + sep + p
                if len(cand) <= max_chars:
                    cur = cand
                else:
                    if cur:
                        lines.append(cur)
                    cur = p
            if cur:
                lines.append(cur)
            return lines[:3] or [text]
    return [text[:max_chars], text[max_chars : max_chars * 2]]


def make_slide(
    path: Path,
    brand: str,
    heading: str,
    eyebrow: str,
    photo: Path | None,
    credit: str,
) -> None:
    w, h = 1920, 1080
    img = Image.new("RGB", (w, h), (16, 28, 44))
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, w, 8), fill=(196, 72, 48))
    draw.rectangle((0, 0, 10, h), fill=(196, 72, 48))
    # Footer band for credit only (captions sit above this)
    footer_h = 56
    draw.rectangle((0, h - footer_h, w, h), fill=(10, 18, 28))

    # Right photo panel
    panel = (1020, 72, 1860, h - footer_h - 24)
    draw.rectangle(panel, fill=(24, 40, 60))
    if photo and photo.exists():
        with Image.open(photo) as src:
            fitted = cover_fit(src.convert("RGB"), panel[2] - panel[0], panel[3] - panel[1])
            img.paste(fitted, (panel[0], panel[1]))
    else:
        draw.text((1100, 480), "（画像なし）", fill=(120, 140, 160), font=ImageFont.truetype(FONT, 32))

    font_brand = ImageFont.truetype(FONT, 34)
    font_head = ImageFont.truetype(FONT, 48)
    font_eye = ImageFont.truetype(FONT, 28)
    font_foot = ImageFont.truetype(FONT, 22)
    draw.text((64, 56), brand, fill=(170, 190, 210), font=font_brand)
    draw.rectangle((64, 160, 420, 166), fill=(196, 72, 48))
    y = 200
    for line in wrap_heading(heading, 12):
        draw.text((64, y), line, fill=(255, 255, 255), font=font_head)
        y += 64
    draw.text((64, y + 24), eyebrow, fill=(150, 170, 190), font=font_eye)
    draw.text((64, h - 40), credit, fill=(150, 165, 180), font=font_foot)
    img.save(path, "PNG")


def render_slide_clip(still: Path, duration: float, out: Path) -> None:
    # Fully static — no zoom / pan / shake
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-loop",
            "1",
            "-i",
            str(still),
            "-t",
            f"{duration:.3f}",
            "-r",
            str(FPS),
            "-an",
            "-c:v",
            "libx264",
            "-tune",
            "stillimage",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            str(out),
        ],
        check=True,
        capture_output=True,
    )


def pick_photo(stem: str, heading: str, index: int) -> Path:
    stills = DATA / "stills"
    weekly = {
        0: "akita-winter-street.jpg",
        1: "akita-winter-street.jpg",
        2: "yuzawa-yuinas-open.jpg",
        3: "katagami-yosakoi.jpg",
        4: "kitaakita-demand-taxi.jpg",
        5: "akita-autumn-berries.jpg",
        6: "community-library.jpg",
        7: "akita-winter-street.jpg",
    }
    kouhou = {
        0: "akita-winter-street.jpg",
        1: "fire-command-center.jpg",
        2: "fire-command-center.jpg",
        3: "yokote-blue-night.jpg",
        4: "katagami-yosakoi.jpg",  # stand-in for sports energy
        5: "akita-winter-street.jpg",
    }
    table = weekly if stem.startswith("weekly") else kouhou
    name = table.get(index, "akita-winter-street.jpg")
    # heading-based overrides
    if "ふわふわ" in heading or "ドーム" in heading:
        name = "katagami-fuwafuwa-dome.jpg"
    elif "しげの" in heading or "原画" in heading or "増田" in heading:
        name = "yokote-shigeno-manga.jpg"
    elif "北鹿" in heading or "鹿角" in heading or "資料館" in heading:
        name = "kazuno-kitaka-travelers.jpg"
    elif "ゆいなす" in heading or "Yuinas" in heading or "湯沢" in heading:
        name = "yuzawa-yuinas-open.jpg"
    elif "よさこい" in heading:
        name = "katagami-yosakoi.jpg"
    elif "デマンド" in heading or "阿仁" in heading:
        name = "kitaakita-demand-taxi.jpg"
    elif "消防" in heading or "119" in heading:
        name = "fire-command-center.jpg"
    elif "ブルー" in heading or "暮らし" in heading:
        name = "yokote-blue-night.jpg"
    elif "除雪" in heading or "踏切" in heading or "冬の道" in heading:
        name = "akita-winter-street.jpg"
    elif "バス" in heading or "支え合い" in heading:
        name = "community-library.jpg"
    elif "日本語" in heading or "ひろば" in heading or "講座" in heading:
        name = "community-library.jpg"
    elif "水道" in heading or "年末" in heading or "納期" in heading:
        name = "akita-winter-street.jpg"
    return stills / name


def concat_videos(parts: list[Path], out: Path) -> None:
    list_path = out.with_suffix(".txt")
    list_path.write_text(
        "".join(f"file '{p.resolve()}'\n" for p in parts),
        encoding="utf-8",
    )
    subprocess.run(
        [
            FFMPEG,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(list_path),
            "-c",
            "copy",
            str(out),
        ],
        check=True,
        capture_output=True,
    )


def split_cues(text: str) -> list[str]:
    parts = re.split(r"(?<=[。！？\n])", text)
    return [p.strip() for p in parts if p.strip()] or [text.strip()]


def cues_for_section(text: str, start: float, duration: float) -> list[tuple[float, float, str]]:
    bits = split_cues(text)
    weights = [max(len(b), 1) for b in bits]
    total = sum(weights)
    out: list[tuple[float, float, str]] = []
    t = start
    for i, (bit, w) in enumerate(zip(bits, weights)):
        span = duration * (w / total)
        end = start + duration if i == len(bits) - 1 else min(start + duration, t + span)
        if end <= t:
            end = min(start + duration, t + 0.35)
        out.append((t, end, bit))
        t = end
    return out


def make_caption_png(text: str, path: Path) -> None:
    # Full-frame transparent PNG; caption box sits above the credit footer (~56px)
    w, h = 1920, 1080
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 40)
    max_chars = 28
    lines: list[str] = []
    rest = text
    while rest:
        if len(rest) <= max_chars:
            lines.append(rest)
            break
        cut = rest.rfind("、", 0, max_chars + 1)
        if cut < max_chars // 2:
            cut = max_chars
        lines.append(rest[:cut].rstrip("、"))
        rest = rest[cut:].lstrip("、")
    lines = lines[:3]
    box_h = 36 + 52 * len(lines)
    # Lift above footer so credit and captions do not overlap
    bottom_margin = 100
    top = h - bottom_margin - box_h
    draw.rounded_rectangle((60, top, w - 60, top + box_h), radius=12, fill=(0, 0, 0, 170))
    y = top + 18
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        tw = bbox[2] - bbox[0]
        draw.text(((w - tw) / 2, y), line, fill=(255, 255, 255, 255), font=font)
        y += 52
    img.save(path, "PNG")


def mux_burn(
    video: Path,
    audio: Path,
    cues: list[tuple[float, float, str]],
    cap_dir: Path,
    out: Path,
) -> None:
    """Burn captions via PNG overlays (this ffmpeg build has no libass)."""
    cap_dir.mkdir(parents=True, exist_ok=True)
    for old in cap_dir.glob("cap_*.png"):
        old.unlink()

    # Keep filter graph manageable
    max_cues = 80
    use = cues[:max_cues]
    cap_paths: list[Path] = []
    for i, (_s, _e, text) in enumerate(use):
        p = cap_dir / f"cap_{i:03d}.png"
        make_caption_png(text, p)
        cap_paths.append(p)

    cmd: list[str] = [FFMPEG, "-y", "-i", str(video), "-i", str(audio)]
    for p in cap_paths:
        cmd += ["-i", str(p)]

    if not cap_paths:
        filter_complex = "[0:v]copy[vout]"
    else:
        parts: list[str] = []
        prev = "0:v"
        for i, (start, end, _text) in enumerate(use):
            inp = i + 2  # 0=video, 1=audio
            nxt = "vout" if i == len(use) - 1 else f"v{i}"
            # full-frame caption PNG already positioned above footer
            parts.append(
                f"[{prev}][{inp}:v]overlay=0:0:enable='between(t\\,{start:.3f}\\,{end:.3f})'[{nxt}]"
            )
            prev = nxt
        filter_complex = ";".join(parts)

    cmd += [
        "-filter_complex",
        filter_complex,
        "-map",
        "[vout]",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        str(out),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"ffmpeg burn failed:\n{proc.stderr[-1500:]}")


def build_one(
    *,
    script_path: Path,
    brand: str,
    eyebrow: str,
    credit: str,
    api_key: str,
    force_tts: bool = True,
) -> Path:
    sections = parse_script(script_path)
    stem = script_path.stem
    work = DATA / "work" / stem
    work.mkdir(parents=True, exist_ok=True)
    for sub in ("images", "audio", "subs", "out", "stills", "scripts"):
        (DATA / sub).mkdir(parents=True, exist_ok=True)

    readings = load_tts_readings()
    if readings:
        print(f"[{stem}] TTS readings: {len(readings)} entries from {TTS_READINGS_PATH.name}")

    audio_parts: list[Path] = []
    video_parts: list[Path] = []
    cues: list[tuple[float, float, str]] = []
    t_cursor = 0.0
    silence = work / "silence.mp3"
    make_silence(silence, GAP_SEC)

    for i, sec in enumerate(sections):
        print(f"[{stem}] section {i + 1}/{len(sections)}: {sec.heading}")
        clip_mp3 = work / f"sec_{i:02d}.mp3"
        if force_tts or not clip_mp3.exists():
            synthesize(sec.speak_text, api_key, clip_mp3, readings=readings)
        dur = audio_duration(clip_mp3)

        slide = DATA / "images" / f"{stem}_{i:02d}.png"
        photo = pick_photo(stem, sec.heading, i)
        make_slide(slide, brand, sec.heading, eyebrow, photo, credit)
        clip_mp4 = work / f"sec_{i:02d}.mp4"
        render_slide_clip(slide, dur, clip_mp4)

        cues.extend(cues_for_section(sec.speak_text, t_cursor, dur))
        audio_parts.append(clip_mp3)
        video_parts.append(clip_mp4)
        t_cursor += dur

        if i < len(sections) - 1:
            gap_mp4 = work / f"gap_{i:02d}.mp4"
            render_slide_clip(slide, GAP_SEC, gap_mp4)
            audio_parts.append(silence)
            video_parts.append(gap_mp4)
            t_cursor += GAP_SEC

    full_audio = DATA / "audio" / f"{stem}.mp3"
    full_video = work / "video_raw.mp4"
    print(f"[{stem}] concat audio/video…")
    concat_audio(audio_parts, full_audio)
    concat_videos(video_parts, full_video)

    out = DATA / "out" / f"{stem}.mp4"
    print(f"[{stem}] burn captions ({len(cues)} cues)…")
    mux_burn(full_video, full_audio, cues, work / "caps", out)
    total = audio_duration(full_audio)
    print(f"[{stem}] -> {out} ({total:.1f}s)")
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Build nabecco news video (TTS + stills)")
    parser.add_argument(
        "--kind",
        choices=("weekly", "kouhou"),
        default="weekly",
        help="weekly = 記事ニュース / kouhou = 広報要約（運用開始は2026-12号から）",
    )
    parser.add_argument("--vol", type=int, help="weekly: issue number (script: weekly-volN.txt)")
    parser.add_argument(
        "--script",
        type=Path,
        help="override path to narration script under data/video/scripts/",
    )
    parser.add_argument("--eyebrow", default="", help="on-screen subtitle under heading")
    parser.add_argument("--force-tts", action="store_true", help="regenerate section audio")
    args = parser.parse_args()

    api_key = load_api_key()

    if args.script:
        script_path = args.script if args.script.is_absolute() else DATA / "scripts" / args.script
    elif args.kind == "weekly":
        if args.vol is None:
            raise SystemExit("--vol N is required for --kind weekly")
        script_path = DATA / "scripts" / f"weekly-vol{args.vol}.txt"
    else:
        raise SystemExit(
            "kouhou videos start from 2026-12. Pass --script <file> under data/video/scripts/ when ready."
        )

    if not script_path.exists():
        raise SystemExit(f"script not found: {script_path}")

    if args.kind == "weekly":
        brand = "なべっこニュース"
        credit = "提供：なべっこ"
        eyebrow = args.eyebrow or (f"第{args.vol}号" if args.vol else "")
    else:
        brand = "なべっこ　広報ニュース"
        credit = "提供：なべっこ（自治体広報をもとに要約）"
        eyebrow = args.eyebrow or ""

    out = build_one(
        script_path=script_path,
        brand=brand,
        eyebrow=eyebrow,
        credit=credit,
        api_key=api_key,
        force_tts=args.force_tts,
    )
    print(f"done: {out}")


if __name__ == "__main__":
    main()
