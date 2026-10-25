# なべっこ（nabecco.media）

秋田県および全市町村の公式広報と、街の声を週ごとに要約・統合するオープンソース地域メディアです。

- **サイト（予定）:** https://nabecco.media
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

## 記事の追加

1. `src/content/posts/vol-N.md` を追加
2. Frontmatter に `title` / `pubDate` / `vol`（任意で `description`）
3. 本文を Markdown で書く（出典付き・丸写し禁止）
4. 人間確認のうえ commit / push

## スポンサー概要

プラチナ / ゴールド / シルバーの掲出枠をサイトに用意しています。詳細と謝辞は [SPONSORS.md](./SPONSORS.md) を参照してください。

## ライセンス

コードと記事データのライセンスは後続で確定します。当面は CONTRIBUTING / POLICY に従って貢献してください。
