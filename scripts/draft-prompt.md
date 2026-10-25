# Issue draft instructions (agent-agnostic)

Use this file when drafting a weekly issue. The **runtime dependency is files on disk**, not any specific IDE or LLM vendor.

> Policy note: operators currently ask a **Cursor agent** to follow these steps. That is an operational choice, not a code dependency. A future OpenAI / Anthropic / Gemini (or other) adapter can plug in behind the same I/O contract without changing fetch or YAML.

## I/O contract

| Role | Path |
| :--- | :--- |
| Input — 広報 PDFs | `data/kouhou/**/*.pdf` (from `npm run fetch:kouhou`) |
| Input — source rules | `sources/municipalities.yaml` |
| Input — optional口コミ | `data/kuchikomi/*.txt` (example: `data/kuchikomi/example.txt`) |
| Input — policy | `POLICY.md` |
| Output — article | `src/content/posts/vol-N.md` |
| Never | auto `git commit` / `git push` / publish |

Helper that only prints paths + this checklist (no external LLM API):

```bash
npm run draft -- --vol N --date YYYY-MM-DD
```

## Steps

1. Confirm PDFs exist under `data/kouhou/`. If empty, stop and tell the operator to run `npm run fetch:kouhou`.
2. Read `POLICY.md` (no verbatim copy; prioritize events / new facilities / workshops; skip routine admin procedures).
3. Skim available PDFs and optional口コミ notes. Prefer breadth across municipalities over deep paraphrase of one issue.
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

5. Attach citations per item (`> 出典: …` with municipality / issue and listing URL when known from `municipalities.yaml`).
6. Stop for **human review**. Operator runs quality checks and commits manually.

## Hard rules

- Japanese Markdown only for the article body
- No丸写し of 広報 text
- Do not invent dates, places, or fees — omit if unclear
- Do not commit, push, or deploy
- Do not call vendor LLM APIs from repo scripts unless a future adapter is explicitly added

## Future adapters (optional)

Same contract: read `data/kouhou/` (+口コミ) → write `src/content/posts/vol-N.md`.  
Suggested home for a later API client: `scripts/lib/draft-adapter.mjs` (not present today). Core fetch (`fetch:kouhou`) and content schema stay unchanged.
