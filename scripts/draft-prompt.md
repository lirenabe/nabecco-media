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
| Input — optional口コミ | **`data/kuchikomi/extracted/{pubDate}/posts.json`** (+ `posts.md`) from `npm run extract:kuchikomi`. Raw HTML dump is extract input only. Optional `{pubDate}.txt` URL index |
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
3a. **口コミ（Threads）2 stages — like kouhou extract→draft:**
   - **B′ extract:** operator drops human-exported HTML at `data/kuchikomi/{pubDate}/` or `{pubDate}.threads.html`.
     Run `npm run extract:kuchikomi -- --date {pubDate}` → `data/kuchikomi/extracted/{pubDate}/posts.json` + `posts.md`.
   - **C draft input:** read **those extracted files only** (not the raw HTML). Optional URL index: `{pubDate}.txt`.
   - See `docs/kuchikomi.md` and `docs/threads-citation-rules.md`.
   - **Never** HTTP-fetch/scrape Threads post pages. Official **oEmbed** is allowed only to obtain embed markup for a known permalink. Do not invent posts or URLs.
3b. **WAIT (chat pause):** if extracted posts are missing, tell the drop path / ask for `extract:kuchikomi`, then **stop**.
   Resume when posts.json exists or operator says skip口コミ. Do not fill gaps via network.
3c. After resume, draft口コミ **only from** `posts.json` / `posts.md` (street-voice color, not verified fact).
   **Selection gates:**
   - Prefer concrete scene / seasonal body / civic feeling / **customer shop visits**.
   - **Shop tip:** ordinary diner口コミ about a restaurant is **OK and welcome**.
   - Skip only **本人による宣伝** (business-owner self-promo: 「本日営業」「お待ちしてます」、自店の営業案内、出店のいいね乞い、等).
   - Also skip: defamation, doxxing, private/non-public, thin weather-only / empty cheer lines.
   - Creator CTAs (「チャンネル登録」) without a real visit scene → skip or cut.
     A visit scene may stay if the food/place is the point.
   - Cap **about 2–3 bundles** under `## 今週のあきた`; quality over coverage; do not crowd out kouhou tips.
   - **Official-first:**市政広報 wins on conflict;口コミ must not override dates/fees.
   **Shape (grouping + embeds — decided):**
   - Abstract axes: **地域** (県北／県央／県南; optional 沿岸／内陸) and **テーマ** (フード／イベント／季節／暮らし／…).
   - **交差型 first** (e.g. `### 県南のフード`). Thin cross → region-only or theme-only fallback.
   - Bundle body: optional **1–2 sentence** lead-in + **official oEmbed column** (embeds carry the post).
   - Do **not** force summary-article paraphrase of each post.
   - Ban process-meta / “we summarized Threads” voice.
   - Grouping detail lives in vault `.cursor` heuristics; **embed markup stays in the repo article**.
   - Citation per embed: `> 出典: 口コミ（Threads）` + `permalink`. Never paste dump HTML / `_files` media.
4. Write `src/content/posts/vol-N.md` as readable articles.
   Use real ATX heading levels (not CSS-only). Do **not** put `第N号` as a heading.
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
- **Baseline criteria** when choosing among candidates: (a) eye-catching title, (b) eye-catching image, (c) interesting topic
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
- **口コミ (optional):** from `extracted/.../posts.json` only; seed/color 今週のあきた (past buzz / recent talk)
- **Bundles:** 交差型（地域×テーマ）推奨; 片軸フォールバック; about 2–3 `###` bundles
- Body: short optional lead-in + **oEmbed column** (no forced summary articles)
- Never assert rumor as fact; never invent dates/places
- If a pickup already used the same tip, do not duplicate
- **口コミ citation:** full every embed — `> 出典: 口コミ（Threads）` + `permalink` (no 「同上」)
- Omit posts with no usable permalink / text; no process meta in body

5. Attach a **full** citation per item (`> 出典: …` + listing URL or口コミ URL). Never use 「同上」「同」「前掲」.
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
- **口コミ:** draft from `posts.json` only
- Same: selection gates; 交差型 bundles first; embed markup in repo; grouping heuristics in vault
- Same: `出典: 口コミ（Threads）` + permalink per embed; no forced summary-article
- Same: shop tips OK unless 本人宣伝; no rumor-as-fact; no process meta
- Do not commit, push, or deploy from the agent unless the operator asks after review
- Do not call vendor LLM APIs from repo scripts unless a future adapter is explicitly added
- Prefer extracted artifacts over re-parsing PDFs every draft
- This file is the **complete** portable Step C contract

## Future adapters (optional)

Same contract: read `data/kouhou/extracted/` (+口コミ) → write `src/content/posts/vol-N.md`.  
Suggested home for a later API client: `scripts/lib/draft-adapter.mjs` (not present today).
