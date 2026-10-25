# なべっこ（nabecco.media）

秋田県および全市町村の公式広報と、街の声を週ごとに要約・統合するオープンソース地域メディアです。

- **サイト:** https://nabecco.media（カスタムドメイン） / https://lirenabe.github.io/nabecco-media/（Pages 既定URL）
- **リポジトリ:** https://github.com/lirenabe/nabecco-media
- **方針:** バナー広告なし。協賛ロゴとクレジットで支える

## ドキュメント

- [メディアポリシー（POLICY.md）](./POLICY.md)
- [貢献ガイド（CONTRIBUTING.md）](./CONTRIBUTING.md)
- [オフィシャルサポーター（SPONSORS.md）](./SPONSORS.md)

## 技術スタック

- [Astro](https://astro.build)（静的出力）
- Content Collections（`src/content/posts/`）
- GitHub Pages 想定（カスタムドメイン `nabecco.media`）

Node.js **22.23.4 以上**が必要です（`.node-version` あり）。

## サイト構成

| パス | 内容 |
| :--- | :--- |
| `/` | 最新号のみ（本文フル表示）。過去号リストは置かない |
| `/issues/` | バックナンバー一覧（最新号を除く過去号を日付・タイトル降順） |
| `/issues/[slug]/` | 各号の詳細 |

ヘッダーはブランド名＋ハンバーガーのみ。メニュー内は直近の過去号（最大5件、最新号は除く）と `/issues/` への一覧リンク。サイトについて・サポーター・ポリシー等はフッター側。

## ローカル起動

```bash
cd ~/workspace/nabecco-media
npm install
npm run dev
```

ブラウザで表示された URL（通常 `http://localhost:4321`）を開きます。

```bash
npm run build    # 本番ビルド → dist/
npm run preview  # ビルド結果のプレビュー
```

## デプロイ（GitHub Pages）

`main` への push、または Actions の手動実行でデプロイします。
ワークフローは Astro をビルドし、GitHub Pages へ公開します。
実装は `actions/deploy-pages` です（`.github/workflows/deploy.yml`）。

- Astro `site`: `https://nabecco.media`（`astro.config.mjs`）。カスタムドメインのため `base` は `/`
- `public/CNAME`: `nabecco.media`
- リポジトリ Settings → Pages → Source を **GitHub Actions** にする（初回のみ）

**DNS（運営者側）:** `nabecco.media` の DNS（Cloudflare 等）はリポジトリ外で設定します。GitHub Pages のカスタムドメイン案内に従い、A / AAAA または CNAME を向けてください。DNS が未接続でも `*.github.io` 側でビルド結果は確認できます。

## 品質チェック

| チェック | ツール | 実行場所 | PR/`main` で失敗するか |
| :--- | :--- | :--- | :---: |
| 日本語校正 | textlint（ja-technical-writing、緩い設定） | CI + pre-commit | はい |
| リンク切れ | markdown-link-check + linkinator（preview 巡回） | CI（md は pre-commit も） | はい |
| デザイン禁止（カード枠ヒューリスティクス） | `scripts/check-design.mjs` | CI + pre-commit | はい |
| 出典の有無（構造） | `scripts/check-citations.mjs` | CI + pre-commit | はい |
| a11y | Playwright + axe（WCAG A/AA）＋ 375 / 1280 の横溢れスモーク | CI のみ | はい |
| SEO / OGP | `scripts/check-seo.mjs`（title / description / canonical / lang / og:* / twitter:card / robots / sitemap） | CI のみ | はい |
| ファクトチェック（LLM） | stub（`npm run factcheck`） | 手動 / `workflow_dispatch` のみ | **いいえ** |

ローカルでは次を使います。

```bash
npm run check:fast   # textlint / design / citations / md links
npm run build && npm run check:links:site && npm run check:a11y && npm run check:seo
npm run check        # 上記の一括（要 Playwright Chromium）
```

初回のみ a11y 用ブラウザ: `npx playwright install chromium`

Git hook: `simple-git-hooks` + `lint-staged`（`npm install` で有効化）。任意で [pre-commit](https://pre-commit.com/) も `.pre-commit-config.yaml` あり。

**ファクトチェックの限界:** 自動での真偽判定は行いません。実質的なガードは「まとまった本文セクションに URL または `> 出典` があること」と、公開前の人の確認（POLICY.md）です。プレースホルダ（「ここに書く」）は免除されます。

**デザインチェックの対象:** 同一 CSS ルール内で `border-radius`（0 / 50% 以外）と箱型 `border` または `box-shadow` が同居するパターンを検出します。`border-top` などの直線のみは許容します。

**SEO / OGP の対象:** `/`・`/issues/`・`/issues/vol-1/` です。
`lang`、title、description、絶対 URL の canonical、`robots.txt`、`sitemap-index.xml` を見ます。
OGP は `og:title` / `og:description` / `og:type` / `og:url` / `og:image` / `og:locale` と `twitter:card` です。
共有画像は `public/og.png`（1200×630）。Lighthouse は使わず、ビルド後 HTML を直接検証します。

## 記事の追加

1. `src/content/posts/vol-N.md` を追加
2. Frontmatter に `title` / `pubDate` / `vol`（任意で `description`）。`title` は例: `第1号 2026年10月25日`（ページ見出し用。本文に H1 は書かない）
3. 本文は次の骨子（細部は今後調整）:

```markdown
## ピックアップ

## 直近のイベント情報

## 今週のあきた
```

4. 出典付き・丸写し禁止。人間確認のうえ commit / push

## スポンサー概要

プラチナ / ゴールド / シルバーの掲出枠をサイトに用意しています。詳細と謝辞は [SPONSORS.md](./SPONSORS.md) を参照してください。

## ライセンス

コードと記事データのライセンスは後続で確定します。当面は CONTRIBUTING / POLICY に従って貢献してください。
