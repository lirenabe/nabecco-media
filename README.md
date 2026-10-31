# なべっこ（nabecco.media）

秋田県および全市町村の公式広報と、街の声を週ごとに要約・統合するオープンソース地域メディアです。

- **サイト（確認用）:** [GitHub Pages](https://lirenabe.github.io/nabecco-media/)
- **カスタムドメイン:** `nabecco.media`（DNS は Pages 向け。HTTPS の状態は [docs/deploy-dns.md](./docs/deploy-dns.md)）
- **リポジトリ:** [lirenabe/nabecco-media](https://github.com/lirenabe/nabecco-media)
- **方針:** バナー広告なし。個人の寄付と店舗・企業・団体のサポートで支える（[SPONSORS.md](./SPONSORS.md)）

## ドキュメント

- [メディアポリシー（POLICY.md）](./POLICY.md)
- [貢献ガイド（CONTRIBUTING.md）](./CONTRIBUTING.md)
- [行動規範（CODE_OF_CONDUCT.md）](./CODE_OF_CONDUCT.md)
- [セキュリティ（SECURITY.md）](./SECURITY.md)
- [支援・サポーター（SPONSORS.md）](./SPONSORS.md)
- [エージェント向け契約（AGENTS.md）](./AGENTS.md)
- [詳細 docs/](./docs/README.md)（品質チェック・デプロイ / DNS・パイプライン）
- [記事下書き契約（scripts/draft-prompt.md）](./scripts/draft-prompt.md)

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

ヘッダーはブランド＋メニュー。サイトについて・支援について・サポーター・ポリシー等はフッター側です。

## ローカル起動

```bash
npm install
npm run dev
```

ブラウザで表示された URL（通常 `http://localhost:4321`）を開きます。

```bash
npm run build    # 本番ビルド → dist/
npm run preview  # ビルド結果のプレビュー
```

デプロイ概要: `main` への push で GitHub Pages へ公開します。詳細は [docs/deploy-dns.md](./docs/deploy-dns.md) です。

品質チェックの一覧とコマンドは [docs/quality.md](./docs/quality.md) です（入口: `npm run check:fast` / `npm run check`）。

## 広報取得〜記事下書き

週次フローはファイル I/O のみの **3 ステップ**です（特定 LLM / IDE API へのコード依存はありません）。

```bash
npm run fetch:kouhou      # A) PDF取得
npm run extract:kouhou    # B) 内容抽出
npm run draft -- --vol N --date YYYY-MM-DD   # C) 下書きチェックリスト
npm run prose-review -- --vol N             # C′) 文章の書き方チェック（textlint とは別）
```

手順の正本は [`scripts/draft-prompt.md`](./scripts/draft-prompt.md) です。文章レビューは [`scripts/prose-review-prompt.md`](./scripts/prose-review-prompt.md)。YAML・キャッシュなどの補足は [docs/pipeline.md](./docs/pipeline.md) です。ピックアップの AI 生成画像ルールは [docs/ai-generated-images.md](./docs/ai-generated-images.md) です。
**人間が Markdown を確認してから** commit / push します（自動公開なし）。

## 記事の追加

1. `src/content/posts/vol-N.md` を追加
2. Frontmatter に `title` / `pubDate` / `vol`（任意で `description`）。確認中は **`draft: true`**
3. 見出し階層は `scripts/draft-prompt.md` に従う（先頭ピックアップのみ `#`）
4. 出典付き・丸写し禁止。広報抽出写真は権利確認まで埋め込まない
5. 人間確認のうえ commit。本番公開時だけ `draft` を外す（詳細は [docs/pipeline.md](./docs/pipeline.md)）

## 支援・サポーター

個人・店舗・企業・団体の支援プランは、サイトのフッター「支援について」と [SPONSORS.md](./SPONSORS.md) に記載しています。サポーター枠の掲載は準備中です。

## ライセンス

- **コード:** [MIT](./LICENSE)
- **なべっこが執筆した記事本文:** [CC BY 4.0](./LICENSE-CONTENT.md)（推奨クレジット:「なべっこ（nabecco.media）, CC BY 4.0」）。広報由来の画像・引用、AI 生成画像、およびロゴ／名称／favicon 等のブランド資産は対象外です（各ファイルの注記を参照）。

アクセス解析には GA4 を用います。質問・報告は [GitHub Issues](https://github.com/lirenabe/nabecco-media/issues) へどうぞ。

## 環境変数

本番ビルドでは GitHub Actions の repository variable `PUBLIC_GA_MEASUREMENT_ID` を渡します。ローカルで計測を試す場合は `.env`（gitignored）に同じ名前を置きます。雛形は [`.env.example`](./.env.example) です。フッター「支援について」の寄付ボタンのリンク先は `PUBLIC_DONATION_ONCE_URL`（個人・1 回）と `PUBLIC_DONATION_MONTHLY_URL`（個人・毎月）で指定します。未設定の場合はボタンの代わりに「受付準備中」と表示します。
