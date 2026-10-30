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
```

Write `src/content/posts/vol-N.md`, then **stop for human review** (no auto-push). Step B needs Python 3 + `pypdf` (optional `pypdf[image]` / pillow for embedded images).

Step C: weekly **media 読み物** (not a 広報 digest). ですます; full citations (no 「同上」); images via `public/images/kouhou/vol-N/`.

Locked heading map: first pickup `#`, later pickups / 直近 / 今週のあきた `##`,
items `###`. No umbrella ピックアップ. See `scripts/draft-prompt.md`.

## Project docs (read these)

- Policy: `POLICY.md`
- Step C contract: `scripts/draft-prompt.md`
- Pipeline / YAML / cache: `docs/pipeline.md`
- Quality checks: `docs/quality.md`
- Deploy / DNS: `docs/deploy-dns.md`
- Contributing: `CONTRIBUTING.md`

The portable contract is the tracked files above (do not require untracked local helper settings).

## Astro

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
