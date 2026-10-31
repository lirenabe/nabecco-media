#!/usr/bin/env python3
"""Extract text + embedded images from a PDF into an output directory.

Step B for nabecco-media. Prefers PyMuPDF (pymupdf) for text because many
Japanese 広報 PDFs use Adobe-Japan1 CID fonts without /ToUnicode; pypdf
alone turns those into mojibake. Falls back to pypdf when pymupdf is absent.

When native text is nearly empty (image-only 広報), retries with Tesseract OCR
via PyMuPDF (`jpn+eng`) if `tesseract` is on PATH.

Usage:
  python3 scripts/lib/extract-pdf.py <pdf> <out_dir> [--max-pages N] [--max-images N]

Deps:
  python3 -m pip install -r scripts/requirements-kouhou.txt
  brew install tesseract tesseract-lang   # OCR fallback for image-only PDFs
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

# Native extract below this → try OCR (CJK / kana / kanji count across body).
OCR_CJK_THRESHOLD = 80
# Page render DPI for OCR (balance quality vs runtime on large 広報).
OCR_DPI = 300
OCR_LANG = "jpn"


def _prepare_out(out_dir: Path) -> Path:
    """Ensure out_dir exists and reset images/ so stale files do not linger."""
    out_dir.mkdir(parents=True, exist_ok=True)
    img_dir = out_dir / "images"
    if img_dir.exists():
        shutil.rmtree(img_dir)
    img_dir.mkdir(parents=True, exist_ok=True)
    return img_dir


def _cjk_count(text: str) -> int:
    return sum(1 for ch in text if "\u3040" <= ch <= "\u30ff" or "\u4e00" <= ch <= "\u9fff")


def _body_from_chunks(chunks: list[str]) -> str:
    return re.sub(r"--- page \d+ ---\n?", "", "\n".join(chunks))


def _write_outputs(
    out_dir: Path,
    pdf_name: str,
    chunks: list[str],
    n_pages: int,
    limit: int,
    saved_images: list[str],
    image_note: str,
    tool: str,
    ocr: bool = False,
    ocr_note: str = "",
) -> dict:
    text_body = "\n\n".join(chunks) + "\n"
    (out_dir / "text.txt").write_text(text_body, encoding="utf-8")
    (out_dir / "content.md").write_text(
        f"# Extracted PDF text\n\nSource: `{pdf_name}`\n\nPages: {limit}/{n_pages}\n\n"
        f"```text\n{text_body[:200000]}\n```\n",
        encoding="utf-8",
    )
    meta = {
        "pagesTotal": n_pages,
        "pagesExtracted": limit,
        "textFile": "text.txt",
        "contentFile": "content.md",
        "images": saved_images,
        "imageCount": len(saved_images),
        "imageNote": image_note,
        "tool": tool,
        "ocr": ocr,
        "ocrNote": ocr_note,
    }
    (out_dir / "extract-meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return meta


def _extract_images_pymupdf(doc, limit: int, max_images: int, img_dir: Path) -> tuple[list[str], str]:
    saved_images: list[str] = []
    image_note = ""
    seen: set[bytes] = set()
    try:
        for i in range(limit):
            if len(saved_images) >= max_images:
                break
            page = doc.load_page(i)
            for img in page.get_images(full=True):
                if len(saved_images) >= max_images:
                    break
                xref = img[0]
                try:
                    info = doc.extract_image(xref)
                except Exception:  # noqa: BLE001
                    continue
                data = info.get("image") or b""
                if not data or data in seen:
                    continue
                seen.add(data)
                ext = (info.get("ext") or "bin").lower()
                if ext == "jpeg":
                    ext = "jpg"
                if ext not in {"jpg", "png", "gif", "bmp", "tif", "tiff", "webp"}:
                    if data[:3] == b"\xff\xd8\xff":
                        ext = "jpg"
                    elif data[:8] == b"\x89PNG\r\n\x1a\n":
                        ext = "png"
                    else:
                        ext = "bin"
                fname = f"img-{len(saved_images):03d}.{ext}"
                (img_dir / fname).write_bytes(data)
                saved_images.append(f"images/{fname}")
    except Exception as exc:  # noqa: BLE001
        image_note = f"image extraction partial/failed: {exc}"
    return saved_images, image_note


def _ocr_pages_pymupdf(doc, limit: int) -> tuple[list[str], str]:
    """OCR each page; returns chunks and a note (empty on full success)."""
    if not shutil.which("tesseract"):
        return [], "tesseract not found on PATH (brew install tesseract tesseract-lang)"

    chunks: list[str] = []
    errors = 0
    for i in range(limit):
        page = doc.load_page(i)
        try:
            # full=True: OCR whole page render (needed for image-only PDFs)
            tp = page.get_textpage_ocr(dpi=OCR_DPI, language=OCR_LANG, full=True)
            text = page.get_text(textpage=tp) or ""
        except Exception as exc:  # noqa: BLE001
            text = f"[page {i + 1} OCR error: {exc}]"
            errors += 1
            print(f"OCR page {i + 1}/{limit} failed: {exc}", file=sys.stderr)
        else:
            print(f"OCR page {i + 1}/{limit} ok chars={len(text)}", file=sys.stderr)
        chunks.append(f"--- page {i + 1} ---\n{text}".rstrip())

    note = ""
    if errors:
        note = f"OCR errors on {errors}/{limit} page(s)"
    return chunks, note


def _extract_pymupdf(pdf_path: Path, out_dir: Path, max_pages: int, max_images: int) -> dict:
    import pymupdf

    img_dir = _prepare_out(out_dir)

    doc = pymupdf.open(pdf_path)
    try:
        n_pages = doc.page_count
        limit = n_pages if max_pages <= 0 else min(n_pages, max_pages)

        chunks: list[str] = []
        for i in range(limit):
            try:
                text = doc.load_page(i).get_text() or ""
            except Exception as exc:  # noqa: BLE001
                text = f"[page {i + 1} extract error: {exc}]"
            chunks.append(f"--- page {i + 1} ---\n{text}".rstrip())

        saved_images, image_note = _extract_images_pymupdf(doc, limit, max_images, img_dir)

        tool = "pymupdf"
        ocr = False
        ocr_note = ""
        if _cjk_count(_body_from_chunks(chunks)) < OCR_CJK_THRESHOLD:
            print(
                f"sparse native text (CJK<{OCR_CJK_THRESHOLD}); trying OCR lang={OCR_LANG} dpi={OCR_DPI}",
                file=sys.stderr,
            )
            ocr_chunks, ocr_note = _ocr_pages_pymupdf(doc, limit)
            if ocr_chunks and _cjk_count(_body_from_chunks(ocr_chunks)) > _cjk_count(
                _body_from_chunks(chunks)
            ):
                chunks = ocr_chunks
                tool = "pymupdf+tesseract"
                ocr = True
            elif ocr_chunks:
                ocr_note = (ocr_note + "; " if ocr_note else "") + "OCR did not improve CJK yield"
            elif not ocr_note:
                ocr_note = "OCR produced no pages"

        return _write_outputs(
            out_dir,
            pdf_path.name,
            chunks,
            n_pages,
            limit,
            saved_images,
            image_note,
            tool,
            ocr=ocr,
            ocr_note=ocr_note,
        )
    finally:
        doc.close()


def _extract_pypdf(pdf_path: Path, out_dir: Path, max_pages: int, max_images: int) -> dict:
    from pypdf import PdfReader

    img_dir = _prepare_out(out_dir)

    reader = PdfReader(str(pdf_path))
    n_pages = len(reader.pages)
    limit = n_pages if max_pages <= 0 else min(n_pages, max_pages)

    chunks: list[str] = []
    for i in range(limit):
        try:
            text = reader.pages[i].extract_text() or ""
        except Exception as exc:  # noqa: BLE001
            text = f"[page {i + 1} extract error: {exc}]"
        chunks.append(f"--- page {i + 1} ---\n{text}".rstrip())

    saved_images: list[str] = []
    image_note = ""
    seen: set[bytes] = set()
    try:
        for page in reader.pages[:limit]:
            if len(saved_images) >= max_images:
                break
            try:
                images = list(page.images)
            except Exception as exc:  # noqa: BLE001
                image_note = f"image iteration skipped: {exc}"
                break
            for image in images:
                if len(saved_images) >= max_images:
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

    return _write_outputs(
        out_dir,
        pdf_path.name,
        chunks,
        n_pages,
        limit,
        saved_images,
        image_note,
        "pypdf",
        ocr=False,
        ocr_note="OCR requires pymupdf + tesseract",
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("out_dir")
    ap.add_argument("--max-pages", type=int, default=0, help="0 = all pages")
    ap.add_argument("--max-images", type=int, default=40)
    args = ap.parse_args()

    pdf_path = Path(args.pdf)
    out_dir = Path(args.out_dir)

    meta: dict
    try:
        import pymupdf  # noqa: F401

        meta = _extract_pymupdf(pdf_path, out_dir, args.max_pages, args.max_images)
    except ImportError:
        try:
            import pypdf  # noqa: F401
        except ImportError:
            print(
                "pymupdf (preferred) or pypdf is required: "
                "python3 -m pip install -r scripts/requirements-kouhou.txt",
                file=sys.stderr,
            )
            return 2
        print(
            "warning: pymupdf not installed; using pypdf "
            "(Japanese CID fonts without ToUnicode may garble; no OCR)",
            file=sys.stderr,
        )
        meta = _extract_pypdf(pdf_path, out_dir, args.max_pages, args.max_images)

    print(json.dumps({"ok": True, **meta}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
