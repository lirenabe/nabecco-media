## Pull requests (language)

<!-- AI: PRのタイトルと本文は日本語で書く。 -->

- Write the **PR title and body in Japanese**.
- Technical terms (GA4, Astro, workflow names, env var names) may stay in English inside Japanese sentences.
- Prefer the sections in `.github/PULL_REQUEST_TEMPLATE.md`（要約 / 確認）.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Weekly kouhou pipeline (3 steps)

File I/O only — no vendor LLM in repo scripts. An agent may be used for Step C as an **operator choice**, not a runtime dependency.

```
# A — PDF取得 (skip-if-unchanged via data/kouhou/manifest.json: sha256 + etag)
npm run fetch:kouhou

# B — 内容抽出 (text + embedded images → data/kouhou/extracted/<id>/; skip if sha unchanged)
npm run extract:kouhou

# C — 記事下書き checklist (agent reads extracts; see scripts/draft-prompt.md)
npm run draft -- --vol N --date YYYY-MM-DD

# C′ — 文章の書き方チェック＆修正 (textlint とは別; scripts/prose-review-prompt.md)
npm run prose-review -- --vol N
```

Write `src/content/posts/vol-N.md`, run **prose-review**, then **stop for human review** (no auto-push). Step B needs Python 3 + `pypdf` (optional `pypdf[image]` / pillow for embedded images).

Step C: weekly **media 読み物** (not a 広報 digest). ですます; full citations (no 「同上」).
Do **not** copy 広報 extract photos into `public/images/kouhou/` until rights are cleared.
New issues use `draft: true` until an operator explicitly publishes.

Locked heading map: first pickup `#`, later pickups / 直近 / 今週のあきた `##`,
region labels `###`（県北→県央→県南）. No umbrella ピックアップ. See `scripts/draft-prompt.md`.

## Project docs (read these)

- Policy: `POLICY.md`
- Step C contract: `scripts/draft-prompt.md`
- Prose review (after draft): `scripts/prose-review-prompt.md`
- Pipeline / YAML / cache: `docs/pipeline.md`
- Quality checks: `docs/quality.md`
- Deploy / DNS: `docs/deploy-dns.md`
- Contributing: `CONTRIBUTING.md`

The portable contract is the tracked files above (do not require untracked local helper settings).

## 公開リポジトリに載せないもの

**公開リポジトリに載せるべきでないものは一切追跡ファイルに入れない。**

- 個人名・非公開の連絡先・ホームパス・勤務先の非公開情報は追跡しない
- ローカル専用の補助設定や私的ヒューリスティック、生ダンプ／抽出 JSON、シークレットも追跡しない
- 私的運用を匂わせる参照や工程メタも書かない
- 記事の広報電話・公開 Threads embed・Actions vars 経由の GA など、意図した公開コンテンツは可
- コミット／PR 前は差分を点検し、迷ったら載せない
- 手順と任意チェックは `docs/quality.md`（`npm run check:public-content`）

## Astro

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
