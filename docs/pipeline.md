# 広報取得〜記事下書き（3 ステップ）

週次フローはファイル I/O のみです。リポジトリは特定の LLM / IDE API に依存しません。
Step C の詳細な執筆契約は [`scripts/draft-prompt.md`](../scripts/draft-prompt.md) が正本です。

## コマンド

```bash
# A) PDF取得 → data/kouhou/<code>_<id>.pdf + manifest.json（未変化はスキップ）
npm run fetch:kouhou
npm run fetch:kouhou -- --only pref-akita,city-yokote
npm run fetch:kouhou -- --force   # キャッシュ無視

# B) 内容抽出 → data/kouhou/extracted/<id>/{text.txt,content.md,images/}
#    PDF の sha256 が同じなら再抽出スキップ。要 Python3 + pypdf
#    埋め込み画像は pillow があると取得（python3 -m pip install 'pypdf[image]'）
npm run extract:kouhou

# （任意）口コミ: 人が Threads HTML を data/kuchikomi/YYYY-MM-DD.threads.html に置く
# 手順は docs/kuchikomi.md ／ 制約は docs/threads-citation-rules.md

# C) 下書きチェックリスト（抽出成果物＋口コミパスを表示。外部 LLM API は呼ばない）
npm run draft -- --vol N --date YYYY-MM-DD
# エージェントが scripts/draft-prompt.md に従い
# extracted（＋口コミ）を読んで src/content/posts/vol-N.md を書く → 人間確認 → commit / push
```

## 補足

- 自治体ごとの取得ルール: [`sources/municipalities.yaml`](../sources/municipalities.yaml)（秋田県＋全市町村。`status: active` のみ自動取得）
- キャッシュ: `data/kouhou/manifest.json` に `url` / `sha256` / 任意で `etag`・`last-modified`。HTTP 304 またはハッシュ一致で再ダウンロードしない
- PDF・抽出物は `data/` 配下（gitignore）。巨大バイナリを commit しない
- 抽出方針は [POLICY.md](../POLICY.md) どおり（丸写し禁止、イベント等を優先、定例手続きは載せない）
- **口コミ（半手動）:** [`docs/kuchikomi.md`](./kuchikomi.md) — 人手エクスポート HTML（＋任意 URL 索引）。[`threads-citation-rules.md`](./threads-citation-rules.md)。エージェントは Threads を fetch しない
- **人間が Markdown を確認してから** `git commit` / `git push` する（自動公開なし）
- 当面の運用では Step C をエージェントへ依頼することがあるが、**コード上の必須依存ではない**

## municipalities.yaml（抜粋）

```yaml
sources:
  - id: pref-akita
    name: 秋田県
    code: "05000"
    status: active   # or incomplete
    listingUrl: https://www.pref.akita.lg.jp/pages/archive/94977
    fetch:
      strategy: listing-pdf   # listing-pdf | issue-then-pdf | skip
      pick: first             # or last
      pdfHrefPattern: "\\.pdf($|\\?)"
      # 任意: preferHrefPattern / preferTextPattern / issueHrefPattern / issueTextPattern など
```
