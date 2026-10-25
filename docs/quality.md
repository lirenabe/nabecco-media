# 品質チェック

ローカルと CI で使う品質チェックの詳細です。

```bash
npm run check:fast   # textlint / design / citations / md links
npm run build && npm run check:links:site && npm run check:a11y && npm run check:seo
npm run check        # 上記の一括（要 Playwright Chromium）
```

初回のみ a11y 用ブラウザ: `npx playwright install chromium`

Git hook: `simple-git-hooks` + `lint-staged`（`npm install` で有効化）。任意で [pre-commit](https://pre-commit.com/) も `.pre-commit-config.yaml` あり。

## 一覧

| チェック | ツール | 実行場所 | PR/`main` で失敗するか |
| :--- | :--- | :--- | :---: |
| 日本語校正 | textlint（ja-technical-writing、緩い設定）。対象は下記「Markdown 対象」 | CI + pre-commit | はい |
| リンク切れ | markdown-link-check（同 Markdown 対象。`nabecco.media` / `github.io` は無視しない）+ linkinator（preview 巡回） | CI（md は pre-commit も） | はい |
| デザイン禁止（カード枠ヒューリスティクス） | `scripts/check-design.mjs` | CI + pre-commit | はい |
| 出典の有無（構造） | `scripts/check-citations.mjs` | CI + pre-commit | はい |
| a11y | Playwright + axe（WCAG A/AA）＋ 375 / 1280 の横溢れスモーク | CI のみ | はい |
| SEO / OGP | `scripts/check-seo.mjs`（title / description / canonical / lang / og:* / twitter:card / robots / sitemap） | CI のみ | はい |
| ファクトチェック（LLM） | stub（`npm run factcheck`） | 手動 / `workflow_dispatch` のみ | **いいえ** |

## Markdown 対象（textlint / md リンク）

トップレベル `*.md`、`docs/` 配下、`src/content/` 配下の Markdown です。
パス一覧は `node scripts/markdown-paths.mjs` で確認できます。

## 補足

**ファクトチェックの限界:** 自動での真偽判定は行いません。実質的なガードは「まとまった本文セクションに URL または `> 出典` があること」と、公開前の人の確認（[POLICY.md](../POLICY.md)）です。プレースホルダ（「ここに書く」）は免除されます。

**デザインチェックの対象:** 同一 CSS ルール内で `border-radius`（0 / 50% 以外）と箱型 `border` または `box-shadow` が同居するパターンを検出します。`border-top` などの直線のみは許容します。

**SEO / OGP の対象:** `/`・`/issues/`・`/issues/vol-1/` です。
`lang`、title、description、絶対 URL の canonical、`robots.txt`、`sitemap-index.xml` を見ます。
OGP は `og:title` / `og:description` / `og:type` / `og:url` / `og:image` / `og:locale` と `twitter:card` です。
共有画像は `public/og.png`（1200×630）。Lighthouse は使わず、ビルド後 HTML を直接検証します。
