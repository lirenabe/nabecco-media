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
| Input — extracted text (**primary**; images stay on disk only) | `data/kouhou/extracted/<id>/` (`text.txt`, `content.md`, `images/`, `meta.json`) — **do not** copy `images/` into the article or `public/` |
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
3. Skim **extracted** `text.txt` / `content.md` across municipalities.
   Local `images/` under `data/kouhou/extracted/` may help judge a topic.
   **Never** embed or copy those images into the article or `public/images/kouhou/`.
   Choose topics worth a media piece — not every calendar line.
   Open a raw PDF only to verify an unclear date/name.
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
   - Quality over coverage; **place口コミ in the same region `###` as related 広報 tips**.
   - **Official-first:**市政広報 wins on conflict;口コミ must not override dates/fees.
   **Shape (region groups + embeds — decided):**
   - `###` headings are **地域のみ**: 県北／県央／県南 — always in that order. **No theme in h3.**
   - **テーマ** (フード／イベント／季節／暮らし／…) has **no heading**; it only sorts items inside a region.
   - Within the same theme: 直近 = date **descending**; 今週のあきた = time **ascending**.
   - **Mix 広報 +口コミ** in the same region `###`. No silo stacks.
   - 広報: `####` tip titles. 口コミ under the region `###`: **one media sentence** in article prose + **oEmbed** (embed still OK).
   - Media voice — concrete place/food/scene. Ban 「要約しました」/「投稿があります」 process-meta.
   - **Embed markup stays in the repo article** (portable). Finer ranking/tag tips may live in local skill helpers — not required to draft.
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
draft: true
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

Frontmatter `draft: true` のままでは本番（`astro build` / GitHub Pages）に出ません。公開するときは `draft: false` にするか行を削除し、人間確認のうえ commit / merge します。ローカル `astro dev` では下書きもプレビューできます。詳細は [`docs/pipeline.md`](../docs/pipeline.md) の「公開ゲート」を参照。

Heading map (locked):

| Level | Use |
| :--- | :--- |
| `#` (h1) | **Only** the first pickup title |
| `##` (h2) | Later pickups (if any); `直近のイベント情報`; `今週のあきた` |
| `###` (h3) | **地域のみ** under 直近 / 今週のあきた — always **県北 → 県央 → 県南** |
| `####` (h4) | Each 広報 tip/event inside a region;口コミ may be embeds under `###` with no extra heading |

### Section roles

#### ピックアップ（題名つき記事・locked）

- **No** `## ピックアップ` umbrella heading
- First selected topic: `# {生成タイトル}` (sole body h1)
- Further pickups (if any): `## {生成タイトル}`
- Place **1–3** such blocks **before** `## 直近のイベント情報`
- **Candidate pool:** topics that would otherwise go in 直近 or 今週のあきた, with enough content for **10+ lines** of prose
- **Select 1–3** from candidates; **remove** them from 直近のイベント情報 and 今週のあきた (no duplicate)
- **Baseline criteria:** (a) eye-catching title, (b) interesting topic
- Local extract photos may inform selection only — **do not embed**
- Body: media 読み物 and ですます. Full citation. **10+ lines** of prose (no 広報写真). Not a PR digest.

#### `## 直近のイベント情報` (locked)

- **Future only:** upcoming from the issue `pubDate` (skip ended / undated)
- **Horizon:** about **3 months** ahead may be included
- **Grouping:** `###` is **地域のみ**（県北／県央／県南）. **Never put theme in the h3.** Theme only orders items inside the region.
- **Region order:** always **県北 → 県央 → 県南** (skip empty).
- **Mix** 広報 events into those region groups — no flat ungrouped tip silo.
- **Sort within each region:** by **theme** (fixed order; no theme heading), then by event date **descending** within the same theme.
- **Exclude** topics already used as ピックアップ in this issue
- **Headings:** `### {県北|県央|県南}` then `#### {題名}` for each event
- **Each item:** date, place, what it is, full citation (fee / capacity / signup when clear)
- **Charm OK:** about **3–5 phone-screen lines** of context per item (not 要項-only; not a long essay)
- **Do not** embed 広報 extract photos in this section
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
- **Grouping:** `###` is **地域のみ**（県北／県央／県南）. **Never put theme in the h3.** Theme only orders items inside the region.
- **Region order:** always **県北 → 県央 → 県南** (skip empty).
- **Mix** 広報-extracted past tips and口コミ into the **same region** — no kouhou-then-口コミ silos.
- **Sort within each region:** by **theme** (no theme heading), then by time **ascending** within the same theme.
- **Exclude** topics already used as ピックアップ in this issue
- **広報 item:** `#### {題名}` then about **5–10 phone-screen lines**; full citation; no 短報
- **口コミ:** under the region `###` — **1 media sentence** + oEmbed; citation per embed. Not embed-only stacks; not long summary articles
- **Do not** embed 広報 extract photos in this section
- **No 問い合わせ / contact lines** in this section
- **口コミ source:** `extracted/.../posts.json` only
- Never assert rumor as fact; never invent dates/places
- If a pickup already used the same tip, do not duplicate
- Omit posts with no usable permalink / text; no process meta in body

5. Attach a **full** citation per item (`> 出典: …` + listing URL or口コミ URL). Never use 「同上」「同」「前掲」.
6. **Do not** copy or embed 広報 extract photos into `public/images/kouhou/` or the article until rights are cleared.
   Keep extracts under `data/kouhou/extracted/` (gitignore). Body = text + citations only.
7. **Prose review loop** (not textlint): `npm run prose-review -- --vol N` then `scripts/prose-review-prompt.md`.
   Fix voice / process-meta / region h3 / 口コミ1文 / citations. Re-run until clean.
8. Stop for **human review**. Keep `draft: true` until an operator explicitly clears it for publish.

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
- **Do not embed 広報 extract photos** until rights are cleared (never link `data/`; do not commit under `public/images/kouhou/`)
- New issues ship with **`draft: true`**; clear the flag only when intentionally publishing
- **ピックアップ:** first `#`, later `##`; no umbrella ピックアップ heading
- Same: 10+ lines of readable prose; remove selected topics from the other two sections（広報写真の埋め込みは権利確認後までしない）
- **`## 直近のイベント情報`:** future only; ~3-month horizon; `###` 県北→県央→県南; theme sort then **date descending**
- Same section: info-note under h2; `####` items; `問い合わせ: …` house style
- Same section: 3–5 charm lines OK; no pickup duplicates
- **`## 今週のあきた`:** past only; ~1-week window; same region `###` order; **mix 広報 +口コミ**
- Same section: `####` 広報 tips;口コミ embeds under region; theme sort then **time ascending**
- Same section: no 問い合わせ; no pickup duplicates
- **口コミ:** draft from `posts.json` only; selection gates; embed markup in repo
- Same: 1 media sentence + embed; `出典: 口コミ（Threads）` + permalink; no 「要約しました」 voice
- Same: shop tips OK unless 本人宣伝; no rumor-as-fact; no process meta
- Do not commit, push, or deploy from the agent unless the operator asks after review
- Do not call vendor LLM APIs from repo scripts unless a future adapter is explicitly added
- Prefer extracted artifacts over re-parsing PDFs every draft
- This file is the **complete** portable Step C contract

## Future adapters (optional)

Same contract: read `data/kouhou/extracted/` (+口コミ) → write `src/content/posts/vol-N.md`.  
Suggested home for a later API client: `scripts/lib/draft-adapter.mjs` (not present today).
