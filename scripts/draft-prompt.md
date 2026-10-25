# Issue draft instructions (agent-agnostic)

Use this file for **Step C — 記事下書き**. The runtime dependency is **files on disk**, not any specific IDE or LLM vendor.

## Core concept — media 読み物 (not a 広報 digest)

なべっこ is a **weekly media**. Each issue must read as **articles / 読み物** for residents.

- **Do:** select what matters, frame why it matters this week, rewrite as weekly-media prose
- **Do not:** paste or lightly paraphrase 広報 into a summary dump
- Avoid 広報まとめ口調, bullet-only PR calendars, and “extract → list” voice
- Sources stay official; the **writing** is media, not a clipping service
- Applies to selection, framing, and style in every section

> Policy note: operators may ask an **agent** to follow these steps. That is an operational choice, not a code dependency. Any LLM adapter can plug in behind the same I/O contract without changing fetch/YAML/extract.

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
3. Skim **extracted** `text.txt` / `content.md` across municipalities (and glance at `images/` when useful). Choose topics worth a media piece — not every calendar line. Open a raw PDF only to verify an unclear date/name.
4. Write `src/content/posts/vol-N.md` as **readable articles** with this heading hierarchy
   (real ATX levels — not CSS-only). Do **not** put `第N号` as a heading.
   Layout shows trailing gray `発行日 {pubDate}` at the article end.

```markdown
---
title: 第N号 YYYY年M月D日
pubDate: YYYY-MM-DD
vol: N
description: （任意・短い要約）
---

# {生成したピックアップ題名1}

（h1 = ページ大見出し。最初のピックアップのみ `#`）

## {生成したピックアップ題名2}

（2本目以降のピックアップは `##`。傘見出し「ピックアップ」は使わない）

## 直近のイベント情報

<aside class="info-note" role="note">…</aside>

### {各イベント題名}

## 今週のあきた

### {各トピック題名}
```

Heading map (locked):

| Level | Use |
| :--- | :--- |
| `#` (h1) | **Only** the first pickup title |
| `##` (h2) | Later pickups (if any); `直近のイベント情報`; `今週のあきた` |
| `###` (h3) | Each event under 直近; each topic under 今週のあきた |

### Section roles

#### ピックアップ（題名つき記事・locked）

- **No** `## ピックアップ` umbrella heading
- First selected topic: `# {生成タイトル}` (sole body h1)
- Further pickups (if any): `## {生成タイトル}`
- Place **1–3** such blocks **before** `## 直近のイベント情報`
- **Candidate pool:** topics that would otherwise go in 直近のイベント情報 or 今週のあきた, and that meet **both**:
  - a usable extract image
  - content rich enough for **10+ lines** of prose
- **Select 1–3** from candidates; **remove** them from 直近のイベント情報 and 今週のあきた (no duplicate)
- **Soft taste (prefer):** (a) a title that catches the eye, (b) an image that catches the eye, (c) an interesting topic
- Body: media 読み物 and ですます. Full citation. **10+ lines** plus image. Not a PR digest.

#### `## 直近のイベント情報` (locked)

- **Future only:** upcoming from the issue `pubDate` (skip ended / undated)
- **Horizon:** about **3 months** ahead may be included
- **When crowded:** prefer **nearer-term** items inside that window
- **Exclude** topics already used as ピックアップ in this issue
- **Each item:** `### {題名}` then date, place, what it is, full citation (fee / capacity / signup when clear)
- **Charm OK:** about **3–5 phone-screen lines** of context per item (not 要項-only; not a long essay)
- Extract images may illustrate an item when useful
- **Info note (required):** immediately under the `##` heading, before any lead or items, insert:

```html
<aside class="info-note" role="note">
<p>日程・料金は各広報の記載時点の情報です。出かける前に、問い合わせ先で最終確認をお願いします。</p>
</aside>
```

- **Section lead (optional):** one short curiosity-led line after the info note
- Lead tone: human interest; not hype; not bureaucratic
- **問い合わせ format:** `問い合わせ: {部署・団体}（{電話}）`
- Example: `問い合わせ: 文化財課（0187-63-8972）`
- Name only: `問い合わせ: {部署・団体}`. Ban `問:` / mixed labels
- Omit the contact line when the source has no contact

#### `## 今週のあきた` (locked)

- **Past only:** what already happened / recent buzz (not the future-events list)
- **Window:** roughly **within 1 week** before run / issue time
- **No special cap** on how many topics may appear when they qualify
- **Exclude** topics already used as ピックアップ in this issue
- **No 短報:** each topic is a **short article**, not a skimpy bullet digest
- **Each topic:** `### {題名}` then about **5–10 phone-screen lines**
- Full citation every topic; extract images when useful (same global voice rules)
- **No 問い合わせ / contact lines** in this section (past reading; readers are not signing up)

5. Attach a **full** citation per item (`> 出典: …` + listing URL). Never use 「同上」「同」「前掲」.
6. Copy usable extract photos/flyers to `public/images/kouhou/vol-N/`. Embed `/images/kouhou/vol-N/…`. Skip icons and `.bin` dumps.
7. Stop for **human review**. Commit the article and any new `public/images/kouhou/vol-N/` files only after review.

## Hard rules

- **Media 読み物 first** — never ship a municipal 広報誌のまとめ / extract digest; rewrite into weekly-media voice
- Ban 広報まとめ口調 and bullet-dumps of PR text; use connective prose and clear framing
- Japanese Markdown only for the article body
- Body h1 is **only** the first pickup title (never `第N号`)
- Layout owns trailing `発行日` label + `pubDate` (do not invent a body date line)
- Do not append 試験下書き / 要確認 footer disclaimers in the article body
- **ですます調** for body prose (です・ます). Do not use だ・である as the default article voice
- No丸写し of 広報 text
- Do not invent dates, places, or fees — omit if unclear
- **出典は省略しない** — full citation every time; no 「同上」「同」「前掲」
- **Use extract images when useful** — serve from `public/images/kouhou/vol-N/` (never link `data/`)
- **ピックアップ:** first `#`, later `##`; no umbrella ピックアップ heading
- Same: image + 10+ lines; remove selected topics from the other two sections
- **`## 直近のイベント情報`:** future only; ~3-month horizon; nearer-term first
- Same section: info-note under h2; each event is `###`; `問い合わせ: …` house style
- Same section: 3–5 charm lines OK; no pickup duplicates
- **`## 今週のあきた`:** past only; ~1-week window; no item-count cap
- Same section: each topic is `###`; short articles (5–10 lines); **no** 問い合わせ
- Same section: no pickup duplicates
- Do not commit, push, or deploy from the agent unless the operator asks after review
- Do not call vendor LLM APIs from repo scripts unless a future adapter is explicitly added
- Prefer extracted artifacts over re-parsing PDFs every draft
- This file is the **complete** portable Step C contract

## Future adapters (optional)

Same contract: read `data/kouhou/extracted/` (+口コミ) → write `src/content/posts/vol-N.md`.  
Suggested home for a later API client: `scripts/lib/draft-adapter.mjs` (not present today).
