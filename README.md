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

`main` への push（または Actions の手動実行）で `.github/workflows/deploy.yml` が Astro をビルドし、[actions/deploy-pages](https://github.com/actions/deploy-pages) 経由で GitHub Pages に公開します。

- Astro `site`: `https://nabecco.media`（`astro.config.mjs`）。カスタムドメインのため `base` は `/`
- `public/CNAME`: `nabecco.media`
- リポジトリ Settings → Pages → Source を **GitHub Actions** にする（初回のみ）

**DNS（運営者側）:** `nabecco.media` の DNS（Cloudflare 等）はリポジトリ外で設定します。GitHub Pages のカスタムドメイン案内に従い、A / AAAA または CNAME を向けてください。DNS が未接続でも `*.github.io` 側でビルド結果は確認できます。

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
