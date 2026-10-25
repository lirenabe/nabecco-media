# 貢献ガイド（CONTRIBUTING）

なべっこへの Pull Request を歓迎します。マージ前に [POLICY.md](./POLICY.md) と [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) も確認してください。

## できること

- 過去号・最新号の誤字脱字、日付・場所・固有名詞の修正
- **閉店・終了・移転**などの追記（削除より「その旨の追記」を原則）
- 出典リンクの追加・修正
- ドキュメント（README / POLICY / SPONSORS / `docs/` 等）の改善
- スポンサーロゴ画像の追加（契約済み・運営合意済みのものに限る）

## PR の進め方

1. ブランチを切って変更する
2. 記事は `src/content/posts/` の Markdown（Frontmatter 付き）を編集
3. 可能なら `npm run build` が通ることを確認
4. PR 本文に「何を・なぜ」直したかを短く書く

### Frontmatter（記事）

必須: `title` / `pubDate` / `vol`  
任意: `description`  
`title` は例: `第1号 2026年10月25日`（`<title>` / OGP 用）。発行日はレイアウトが末尾に表示します。

### 本文の骨子

先頭ピックアップのみ `#`（ページの h1）。以降のピックアップと「直近のイベント情報」「今週のあきた」は `##`、各項目は `###`。傘見出し「ピックアップ」は使いません。詳細は [`scripts/draft-prompt.md`](./scripts/draft-prompt.md) を正本とします。

## 画像ルール

- 置き場所: `public/images/`（スポンサーロゴは `public/images/sponsors/`）
- 巨大な元画像はコミットしない。WebP などへ変換・リサイズ・圧縮してから追加
- 権利が不明な画像や、個人が特定できる写真は置かない
- 広報由来の画像の権利は [LICENSE-CONTENT.md](./LICENSE-CONTENT.md) を参照

## マージしないもの

- 誹謗中傷、差別、プライバシー侵害
- 宣伝目的で偏った口コミや特定店舗の過度な推挙
- バナー広告・アドネットワーク・トラッキング用コードの追加
- 広報紙・他メディアの文章の丸写し
- AI 生成のままの未確認原稿の自動公開を前提とした変更

## 品質・セキュリティ

- ローカルの品質コマンドは [docs/quality.md](./docs/quality.md)
- 脆弱性の報告は [SECURITY.md](./SECURITY.md)

## 質問

[GitHub Issues](https://github.com/lirenabe/nabecco-media/issues) を立てるか、PR の Draft で相談してください。編集方針の最終判断は運営側にあります。
