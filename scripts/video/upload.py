#!/usr/bin/env python3
"""Upload a nabecco news video to YouTube (optional scheduled publish)."""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parents[1]
ENV_PATH = REPO / ".env"
DATA_OUT = REPO / "data" / "video" / "out"

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
API_SERVICE = "youtube"
API_VERSION = "v3"
# News & Politics — https://developers.google.com/youtube/v3/docs/videoCategories/list
DEFAULT_CATEGORY = "25"
MAX_RETRIES = 10
RETRIABLE_STATUS = {500, 502, 503, 504}


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    if not ENV_PATH.is_file():
        return out
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def resolve_path(raw: str | None, default: Path) -> Path:
    if not raw:
        return default
    p = Path(raw)
    return p if p.is_absolute() else REPO / p


def get_youtube(client_secrets: Path, token_path: Path):
    if not client_secrets.is_file():
        raise SystemExit(
            f"OAuth client JSON not found: {client_secrets}\n"
            "Download a Desktop OAuth client from Cloud Console and place it there."
        )

    creds: Credentials | None = None
    if token_path.is_file():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES)
            creds = flow.run_local_server(port=0, prompt="consent")
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(creds.to_json(), encoding="utf-8")
        print(f"Saved token → {token_path}", file=sys.stderr)

    return build(API_SERVICE, API_VERSION, credentials=creds)


def parse_publish_at(raw: str) -> str:
    """Return RFC3339 UTC for status.publishAt."""
    s = raw.strip()
    if s.endswith("Z"):
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    else:
        dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        raise SystemExit(
            "--publish-at needs a timezone offset or Z "
            "(example: 2026-12-01T18:00:00+09:00)"
        )
    utc = dt.astimezone(timezone.utc)
    now = datetime.now(timezone.utc)
    if utc <= now:
        raise SystemExit(
            f"--publish-at is not in the future (parsed UTC {utc.isoformat()}). "
            "A past time publishes immediately and cannot be re-scheduled."
        )
    # YouTube accepts fractional seconds; keep seconds precision
    return utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def resolve_video_file(args: argparse.Namespace) -> Path:
    if args.file:
        path = Path(args.file)
        path = path if path.is_absolute() else REPO / path
    elif args.kind == "weekly":
        if args.vol is None:
            raise SystemExit("--vol is required with --kind weekly")
        path = DATA_OUT / f"weekly-vol{args.vol}.mp4"
    elif args.kind == "kouhou":
        if not args.script_stem:
            raise SystemExit(
                "kouhou upload needs --file … or --script-stem matching "
                "data/video/out/<stem>.mp4"
            )
        path = DATA_OUT / f"{args.script_stem}.mp4"
    else:
        raise SystemExit("Pass --file, or --kind weekly --vol N")

    if not path.is_file():
        raise SystemExit(f"Video file not found: {path}")
    return path


def default_title(args: argparse.Namespace) -> str:
    if args.title:
        return args.title
    if args.kind == "weekly" and args.vol is not None:
        return f"なべっこニュース 第{args.vol}号"
    raise SystemExit("--title is required (or use --kind weekly --vol N for a default)")


def default_description(args: argparse.Namespace) -> str:
    if args.description is not None:
        return args.description
    lines = [
        "秋田の地域メディア「なべっこ」のニュース動画です。",
        "",
        "▼ サイト",
        "https://nabecco.media/",
    ]
    if args.kind == "weekly" and args.vol is not None:
        lines.extend(
            [
                "",
                "▼ この号の記事",
                f"https://nabecco.media/issues/vol-{args.vol}/",
            ]
        )
    lines.extend(
        [
            "",
            "日程・料金などの確定情報は、各公式の原本でご確認ください。",
        ]
    )
    return "\n".join(lines)


def resumable_upload(request) -> dict[str, Any]:
    response = None
    error = None
    retry = 0
    while response is None:
        try:
            print("Uploading…", file=sys.stderr)
            _status, response = request.next_chunk()
            if response is not None and "id" not in response:
                raise SystemExit(f"Unexpected upload response: {response}")
        except HttpError as e:
            if e.resp.status in RETRIABLE_STATUS:
                error = f"HTTP {e.resp.status}: {e.content!r}"
            else:
                raise
        except (OSError, TimeoutError) as e:
            error = str(e)

        if error is not None:
            retry += 1
            if retry > MAX_RETRIES:
                raise SystemExit(f"Upload failed after retries: {error}")
            sleep_s = random.random() * (2**retry)
            print(f"{error}\nRetry in {sleep_s:.1f}s…", file=sys.stderr)
            time.sleep(sleep_s)
            error = None
    return response


def upload_video(
    youtube,
    *,
    file_path: Path,
    title: str,
    description: str,
    category_id: str,
    tags: list[str] | None,
    privacy: str,
    publish_at: str | None,
    made_for_kids: bool,
    synthetic: bool,
) -> dict[str, Any]:
    status: dict[str, Any] = {
        "privacyStatus": privacy,
        "selfDeclaredMadeForKids": made_for_kids,
        "containsSyntheticMedia": synthetic,
    }
    if publish_at:
        if privacy != "private":
            raise SystemExit("Scheduled publish requires --privacy private")
        status["publishAt"] = publish_at

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "categoryId": category_id,
            "defaultLanguage": "ja",
            "defaultAudioLanguage": "ja",
        },
        "status": status,
    }
    if tags:
        body["snippet"]["tags"] = tags

    media = MediaFileUpload(str(file_path), mimetype="video/*", resumable=True, chunksize=1024 * 1024)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)
    return resumable_upload(request)


def set_thumbnail(youtube, video_id: str, thumb_path: Path) -> None:
    media = MediaFileUpload(str(thumb_path))
    youtube.thumbnails().set(videoId=video_id, media_body=media).execute()
    print(f"Thumbnail set ← {thumb_path}", file=sys.stderr)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Upload nabecco news video to YouTube")
    p.add_argument("--file", help="Path to MP4 (default: data/video/out/weekly-volN.mp4)")
    p.add_argument("--kind", choices=("weekly", "kouhou"), help="Convenience naming for defaults")
    p.add_argument("--vol", type=int, help="Issue number when --kind weekly")
    p.add_argument("--script-stem", help="Out file stem when --kind kouhou (without .mp4)")
    p.add_argument("--title", help="Video title")
    p.add_argument("--description", help="Video description (default includes site link)")
    p.add_argument(
        "--publish-at",
        help="Schedule public release (ISO 8601 with offset), e.g. 2026-12-01T18:00:00+09:00",
    )
    p.add_argument(
        "--privacy",
        choices=("private", "public", "unlisted"),
        default="private",
        help="Default private (required for --publish-at)",
    )
    p.add_argument("--category", default=DEFAULT_CATEGORY, help="YouTube categoryId (25=News)")
    p.add_argument("--tags", default="", help="Comma-separated tags")
    p.add_argument("--thumbnail", help="Optional custom thumbnail (jpg/png)")
    p.add_argument(
        "--made-for-kids",
        action="store_true",
        help="Mark as made for kids (default: no)",
    )
    p.add_argument(
        "--no-synthetic",
        action="store_true",
        help="Do not set containsSyntheticMedia (default: set true for TTS/AI visuals)",
    )
    p.add_argument(
        "--auth-only",
        action="store_true",
        help="Only run OAuth and save token.json, then exit",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned request and exit without uploading",
    )
    return p


def main() -> None:
    args = build_parser().parse_args()
    env = load_env()
    client_secrets = resolve_path(
        env.get("YOUTUBE_CLIENT_SECRETS"),
        REPO / "secrets" / "youtube" / "client_secret.json",
    )
    token_path = resolve_path(
        env.get("YOUTUBE_TOKEN"),
        REPO / "secrets" / "youtube" / "token.json",
    )

    if args.auth_only:
        get_youtube(client_secrets, token_path)
        print("OAuth OK.", file=sys.stderr)
        return

    file_path = resolve_video_file(args)
    title = default_title(args)
    description = default_description(args)
    publish_at = parse_publish_at(args.publish_at) if args.publish_at else None
    tags = [t.strip() for t in args.tags.split(",") if t.strip()] or None
    synthetic = not args.no_synthetic

    plan = {
        "file": str(file_path),
        "title": title,
        "description": description,
        "privacy": args.privacy,
        "publishAt": publish_at,
        "categoryId": args.category,
        "tags": tags,
        "madeForKids": args.made_for_kids,
        "containsSyntheticMedia": synthetic,
        "thumbnail": args.thumbnail,
    }
    if args.dry_run:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
        return

    youtube = get_youtube(client_secrets, token_path)
    try:
        resp = upload_video(
            youtube,
            file_path=file_path,
            title=title,
            description=description,
            category_id=args.category,
            tags=tags,
            privacy=args.privacy,
            publish_at=publish_at,
            made_for_kids=args.made_for_kids,
            synthetic=synthetic,
        )
    except HttpError as e:
        raise SystemExit(f"YouTube API error {e.resp.status}: {e.content!r}") from e

    video_id = resp["id"]
    print(f"Uploaded: https://studio.youtube.com/video/{video_id}/edit")
    print(f"Watch URL (after publish): https://youtu.be/{video_id}")
    if publish_at:
        print(f"Scheduled publishAt (UTC): {publish_at}")

    if args.thumbnail:
        thumb = Path(args.thumbnail)
        thumb = thumb if thumb.is_absolute() else REPO / thumb
        if not thumb.is_file():
            raise SystemExit(f"Thumbnail not found: {thumb}")
        try:
            set_thumbnail(youtube, video_id, thumb)
        except HttpError as e:
            print(
                f"Warning: thumbnail failed ({e.resp.status}). "
                "Channel may need phone verification.",
                file=sys.stderr,
            )


if __name__ == "__main__":
    main()
