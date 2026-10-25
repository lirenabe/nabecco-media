#!/usr/bin/env python3
"""Extract text + embedded images from a PDF into an output directory.

MVP for nabecco-media Step B. Requires: pip/pypdf (stdlib pathlib only otherwise).

Usage:
  python3 scripts/lib/extract-pdf.py <pdf> <out_dir> [--max-pages N] [--max-images N]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("out_dir")
    ap.add_argument("--max-pages", type=int, default=0, help="0 = all pages")
    ap.add_argument("--max-images", type=int, default=40)
    args = ap.parse_args()

    try:
        from pypdf import PdfReader
    except ImportError:
        print("pypdf is required: python3 -m pip install pypdf", file=sys.stderr)
        return 2

    pdf_path = Path(args.pdf)
    out_dir = Path(args.out_dir)
    img_dir = out_dir / "images"
    out_dir.mkdir(parents=True, exist_ok=True)
    img_dir.mkdir(parents=True, exist_ok=True)

    reader = PdfReader(str(pdf_path))
    n_pages = len(reader.pages)
    limit = n_pages if args.max_pages <= 0 else min(n_pages, args.max_pages)

    chunks: list[str] = []
    for i in range(limit):
        try:
            text = reader.pages[i].extract_text() or ""
        except Exception as exc:  # noqa: BLE001
            text = f"[page {i + 1} extract error: {exc}]"
        chunks.append(f"--- page {i + 1} ---\n{text}".rstrip())

    text_path = out_dir / "text.txt"
    text_body = "\n\n".join(chunks) + "\n"
    text_path.write_text(text_body, encoding="utf-8")

    # Sidecar markdown summary for agents
    md_path = out_dir / "content.md"
    md_path.write_text(
        f"# Extracted PDF text\n\nSource: `{pdf_path.name}`\n\nPages: {limit}/{n_pages}\n\n"
        f"```text\n{text_body[:200000]}\n```\n",
        encoding="utf-8",
    )

    saved_images: list[str] = []
    image_note = ""
    seen: set[bytes] = set()
    try:
        # page.images requires pillow (pypdf[image]); text extract still works without it
        for page in reader.pages[:limit]:
            if len(saved_images) >= args.max_images:
                break
            try:
                images = list(page.images)
            except Exception as exc:  # noqa: BLE001
                image_note = f"image iteration skipped: {exc}"
                break
            for image in images:
                if len(saved_images) >= args.max_images:
                    break
                try:
                    data = image.data
                except Exception:  # noqa: BLE001
                    continue
                if not data or data in seen:
                    continue
                seen.add(data)
                ext = "bin"
                name = (getattr(image, "name", "") or "").lower()
                if name.endswith((".jpg", ".jpeg")) or data[:3] == b"\xff\xd8\xff":
                    ext = "jpg"
                elif name.endswith(".png") or data[:8] == b"\x89PNG\r\n\x1a\n":
                    ext = "png"
                fname = f"img-{len(saved_images):03d}.{ext}"
                (img_dir / fname).write_bytes(data)
                saved_images.append(f"images/{fname}")
    except ImportError as exc:
        image_note = f"images skipped (install pillow / pypdf[image]): {exc}"

    meta = {
        "pagesTotal": n_pages,
        "pagesExtracted": limit,
        "textFile": "text.txt",
        "contentFile": "content.md",
        "images": saved_images,
        "imageCount": len(saved_images),
        "imageNote": image_note,
        "tool": "pypdf",
    }
    (out_dir / "extract-meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"ok": True, **meta}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
