# Threads 参照・掲載制約（運用要約）

nabecco.media 向けの実務ルールです。規約調査の全文はプロジェクト Context の同名文書を正とします。法的助言ではありません。

## 必須

| 項目 | ルール |
| :--- | :--- |
| 入力 | **人が**ブラウザで保存した HTML（または確認済みの URL／要点）。パスは `docs/kuchikomi.md` |
| エージェント | **`threads.com` を HTTP fetch／スクレイプしない**。渡されたローカルファイルだけ読む |
| 公開形 | **短い言い換え／要約 ＋ パーマリンク出典** |
| Git | 生 HTML ダンプは **gitignore**。記事へ HTML 丸ごと転載しない |

## 禁止に近いもの

- エージェントによる Threads／Meta の自動取得・一括収集
- 投稿全文の転載、画像・動画の再掲、スクリーンショットの常用
- 非公開・ログイン限定由来の持ち出し、誹謗中傷・個人特定・宣伝偏重

## よい例

```markdown
> 出典: 口コミ（Threads）
> https://www.threads.com/@user/post/...
```

公式埋め込み（oEmbed）は表示用途として使える。下書き素材の自動抽出や永続保存には使わない。

## 参照

- 週次手順: [`kuchikomi.md`](./kuchikomi.md)
- 執筆契約: [`scripts/draft-prompt.md`](../scripts/draft-prompt.md)
- 方針: [POLICY.md](../POLICY.md)
