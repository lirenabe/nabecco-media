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

# （任意）口コミ B′: 人手 HTML → 構造化 posts.json / posts.md（threads.com 非接触）
npm run extract:kuchikomi -- --date YYYY-MM-DD
# 手順は docs/kuchikomi.md ／ 制約は docs/threads-citation-rules.md

# C) 下書きチェックリスト（広報 extracted＋口コミ extracted を表示。外部 LLM API は呼ばない）
npm run draft -- --vol N --date YYYY-MM-DD
# エージェントが scripts/draft-prompt.md に従い
# kouhou extracted ＋ kuchikomi extracted を読んで src/content/posts/vol-N.md を書く

# C′) 文章の書き方チェック＆修正（textlint とは別。公開前）
npm run prose-review -- --vol N
# scripts/prose-review-prompt.md に沿い、声・工程メタ・束ね・口コミ1文などを直す → 人間確認 → commit / push
```

## 補足

- 自治体ごとの取得ルール: [`sources/municipalities.yaml`](../sources/municipalities.yaml)（秋田県＋全市町村。`status: active` のみ自動取得）
- キャッシュ: `data/kouhou/manifest.json` に `url` / `sha256` / 任意で `etag`・`last-modified`。HTTP 304 またはハッシュ一致で再ダウンロードしない
- PDF・抽出物は `data/` 配下（gitignore）。巨大バイナリを commit しない
- 抽出方針は [POLICY.md](../POLICY.md) どおり（丸写し禁止、イベント等を優先、定例手続きは載せない）
- **口コミ（半手動・2段）:** [`docs/kuchikomi.md`](./kuchikomi.md) — HTML ドロップ → `extract:kuchikomi` → 構造化ファイルから下書き。[`threads-citation-rules.md`](./threads-citation-rules.md)。投稿ページの fetch はしない（表示用 oEmbed のみ可）
- **人間が Markdown を確認してから** `git commit` / `git push` する（自動公開なし）
- 当面の運用では Step C をエージェントへ依頼することがあるが、**コード上の必須依存ではない**

## 公開ゲート（`draft`）

確認中の号が `main` に載っても、本番サイトに出さないための仕組みです。

1. 新規号の Frontmatter に **`draft: true`** を付ける（雛形どおり）
2. 本番ビルド（`astro build` / GitHub Pages）では `draft: true` の号を除外する（トップ・バックナンバー・`/issues/[slug]/`）
3. ローカル `npm run dev` では下書きもプレビューできる
4. **公開するとき:** `draft: false` にするか `draft` 行を削除 → 人間確認 → merge

公開中の号をいったん下ろす場合は、該当 Markdown を削除するか再び `draft: true` にする。

## 広報画像（抽出は残す・記事には載せない）

Step B はこれまでどおり `data/kouhou/extracted/<id>/images/` に写真を書き出します（gitignore・ローカルのみ）。

Step C と記事では、次のとおり扱います。

- 抽出写真を `public/images/kouhou/` へコピーしない
- Markdown に `![…](/images/kouhou/…)` を書かない
- 題材選びの参考にローカル画像を見るのは可。本番・リポジトリには載せない

権利確認が済むまで、この運用を崩さないでください。

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
