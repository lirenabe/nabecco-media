## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Weekly kouhou pipeline (3 steps)

File I/O only — no vendor LLM in repo scripts. Cursor is an **operator policy** for Step C, not a runtime dependency.

```
# A — PDF取得 (skip-if-unchanged via data/kouhou/manifest.json: sha256 + etag)
npm run fetch:kouhou

# B — 内容抽出 (text + embedded images → data/kouhou/extracted/<id>/; skip if sha unchanged)
npm run extract:kouhou

# C — 記事下書き checklist (agent reads extracts; see scripts/draft-prompt.md)
npm run draft -- --vol N --date YYYY-MM-DD
```

Write `src/content/posts/vol-N.md`, then stop for human review (no auto-push). Step B needs Python 3 + `pypdf` (optional `pypdf[image]` / pillow for embedded images).

Step C basics: ですます調; full citations (no 「同上」); images via `public/images/kouhou/vol-N/`.

Locked section roles in `scripts/draft-prompt.md`: `## 直近のイベント情報`, `## 今週のあきた`. `## ピックアップ` is still TBD.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
