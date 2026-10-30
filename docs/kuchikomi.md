# 口コミの記事反映（Phase 7.2）

広報3ステップに加え、街の声を号の読み物へ取り込む運用です。  
執筆契約: [`scripts/draft-prompt.md`](../scripts/draft-prompt.md)。方針: [POLICY.md](../POLICY.md)。  
**Threads の取得・掲載制約:** [`threads-citation-rules.md`](./threads-citation-rules.md)（要約。詳細調査はプロジェクト Context 同名文書）。エージェントは `threads.com` を fetch しない（公式 oEmbed は埋め込み表示用のみ可）。

## 設計判断（確定）

| 項目 | 判断 |
| :--- | :--- |
| 自動化レベル | **半手動**。SNS API／エージェントによる投稿ページ fetch はしない |
| 主入力 | 人がブラウザで保存した HTML（発行日） |
| 2段パイプライン | **① extract** ローカル HTML → 構造化 `posts.json`／`posts.md` → **② draft** 構造化ファイルから言い換え（＋ permalink 埋め込み） |
| 任意入力 | `data/kuchikomi/YYYY-MM-DD.txt`（URL 索引） |
| 公開形 | **短い言い換え／要約 ＋ パーマリンク**（任意で公式 embed）。HTML 丸ごと転載・画像再掲なし |
| 置き場 | 主に **今週のあきた** |
| Git | `data/kuchikomi/**` は **gitignore**（`example.txt` のみ追跡） |

## 週次の手順（drop → extract → draft）

1. （Kenta）Threads 保存リスト等をブラウザで HTML エクスポートし、`data/kuchikomi/{発行日}/` または `{発行日}.threads.html` へ置く  
2. `fetch:kouhou` → `extract:kouhou`  
3. **`npm run extract:kuchikomi -- --date {発行日}`** → `data/kuchikomi/extracted/{発行日}/posts.json` と `posts.md`  
4. Step C: エージェントは **抽出済み構造化ファイル**を正として下書き（生 HTML を直接読まない）。無ければ待機  
5. 公開形は言い換え＋permalink（必要なら公式 oEmbed blockquote）。`embed.js` はレイアウトで 1 回  
6. 人間がファクトチェック → commit  

## 抽出物の形

```text
data/kuchikomi/extracted/2026-11-01/posts.json   # 機械用
data/kuchikomi/extracted/2026-11-01/posts.md     # 人間／エージェント読書用
```

各投稿の主なフィールドは次のとおりです。`id` / `handle` / `permalink` / `datetime` / `datetimeLabel` / `text` / `hasImage` / `hasVideo` / `mediaCount`

```bash
npm run extract:kuchikomi -- --date 2026-11-01
npm run extract:kuchikomi -- --date 2026-11-01 --force
npm run extract:kuchikomi -- --date 2026-11-01 --input path/to/dump.html
```

## 記事への書き方（要約）

- **公式優先。** 口コミは声として距離を取る（2–4本程度）  
- **1投稿1節**（`###`）。複数 permalink を曖昧に束ねない  
- 言い換えは `text` の具体（数字・場所・仕草・食材）を残す。**5–10行**（短報禁止）  
- 禁止: 工程メタ、へッジ連打、店舗宣伝偏重、未確認の事実断定  
- 出典例:

```markdown
> 出典: 口コミ（Threads）  
> https://www.threads.com/@user/post/...
```

- 任意で公式 oEmbed。詳細: [`threads-citation-rules.md`](./threads-citation-rules.md)  

## チェックリストとの関係

`npm run draft` は任意の URL 索引シェルを用意しうるが、**下書きの正本は extracted/posts.***。  
エージェントはネット取得せず、ローカル抽出物と（表示用の）公式 oEmbed だけを使う。
