# Issue draft instructions (agent-agnostic)

Use this file for **Step C — 記事下書き**. The runtime dependency is **files on disk**, not any specific IDE or LLM vendor.

> Policy note: operators currently ask a **Cursor agent** to follow these steps. That is an operational choice, not a code dependency. A future OpenAI / Anthropic / Gemini (or other) adapter can plug in behind the same I/O contract without changing fetch/YAML/extract.

## Pipeline (3 steps)

| Step | Command | Output |
| :--- | :--- | :--- |
| A — PDF取得 | `npm run fetch:kouhou` | `data/kouhou/<code>_<id>.pdf` + `data/kouhou/manifest.json` (skip-if-unchanged) |
| B — 内容抽出 | `npm run extract:kouhou` | `data/kouhou/extracted/<id>/{text.txt,content.md,images/,meta.json}` |
| C — 記事下書き | this prompt (+ `npm run draft` checklist) | `src/content/posts/vol-N.md` |

## I/O contract (Step C)

| Role | Path |
| :--- | :--- |
| Input — extracted text/images (**primary**) | `data/kouhou/extracted/<id>/` (`text.txt`, `content.md`, `images/`, `meta.json`) |
| Input — manifest | `data/kouhou/manifest.json` (url, sha256, paths) |
| Input — source rules | `sources/municipalities.yaml` |
| Input — optional口コミ | `data/kuchikomi/*.txt` |
| Input — policy | `POLICY.md` |
| Input — raw PDFs (**spot-check only**) | `data/kouhou/*.pdf` — do **not** re-extract everything from PDFs by default |
| Output — article | `src/content/posts/vol-N.md` |
| Never | auto `git commit` / `git push` / publish |

Checklist helper (no external LLM API):

```bash
npm run draft -- --vol N --date YYYY-MM-DD
```

## Steps

1. Confirm Step A + B ran: PDFs in `data/kouhou/` and extracts under `data/kouhou/extracted/`. If extracts are missing, stop and tell the operator to run `npm run extract:kouhou`.
2. Read `POLICY.md` (no verbatim copy; prioritize events / new facilities / workshops; skip routine admin procedures).
3. Skim **extracted** `text.txt` / `content.md` across municipalities (and glance at `images/` when useful). Prefer breadth over deep paraphrase of one issue. Open a raw PDF only to verify an unclear date/name.
4. Write `src/content/posts/vol-N.md` with this shape (no H1 in the body):

```markdown
---
title: 第N号 YYYY年M月D日
pubDate: YYYY-MM-DD
vol: N
description: （任意・短い要約）
---

## ピックアップ

## 直近のイベント情報

## 今週のあきた
```

5. Attach citations per item (`> 出典: …` with municipality / issue and listing URL from `municipalities.yaml` or manifest).
6. Stop for **human review**. Operator runs quality checks and commits manually.

## Hard rules

- Japanese Markdown only for the article body
- No丸写し of 広報 text
- Do not invent dates, places, or fees — omit if unclear
- Do not commit, push, or deploy
- Do not call vendor LLM APIs from repo scripts unless a future adapter is explicitly added
- Prefer extracted artifacts over re-parsing PDFs every draft

## Future adapters (optional)

Same contract: read `data/kouhou/extracted/` (+口コミ) → write `src/content/posts/vol-N.md`.  
Suggested home for a later API client: `scripts/lib/draft-adapter.mjs` (not present today).
