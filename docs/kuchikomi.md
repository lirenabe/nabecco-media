# 口コミの記事反映（Phase 7.2）

広報3ステップに加え、街の声を号へ取り込む運用です。  
執筆契約: [`scripts/draft-prompt.md`](../scripts/draft-prompt.md)。方針: [POLICY.md](../POLICY.md)。  
**Threads の取得・掲載制約:** [`threads-citation-rules.md`](./threads-citation-rules.md)（要約。詳細調査はリポ外の調査メモ・非公開・任意）。エージェントは `threads.com` を fetch しない（公式 oEmbed は埋め込み表示用のみ可）。

## 設計判断（確定）

| 項目 | 判断 |
| :--- | :--- |
| 自動化レベル | **半手動**。SNS API／エージェントによる投稿ページ fetch はしない |
| 主入力 | 人がブラウザで保存した HTML（発行日） |
| 2段パイプライン | **① extract** ローカル HTML → 構造化 `posts.json`／`posts.md` → **② draft** 構造化ファイルから束ね＋ embed |
| 任意入力 | `data/kuchikomi/YYYY-MM-DD.txt`（URL 索引） |
| 公開形 | 地域 `###` のもと **1文のメディア要約＋公式 embed**（長文要約記事は作らない）。HTML 丸ごと転載・画像再掲なし |
| 束ね方 | `###` は **地域のみ**（県北→県央→県南）。テーマは見出しにしない。**広報も同地域へ混在** |
| 並び（地域内） | テーマ順のあと、直近 = **降順**／今週のあきた = **昇順** |
| ドキュメント分担 | **portable（本リポ）** = 見出し契約・embed・出典・最低選別。細かい並べ／タグの厚みはローカル skill 補助（任意・非追跡） |
| 置き場 | 主に **今週のあきた** |
| Git | `data/kuchikomi/**` は **gitignore**（`example.txt` のみ追跡） |

## 週次の手順（drop → extract → draft）

1. （人間オペレータ）Threads 保存リスト等をブラウザで HTML エクスポートし、`data/kuchikomi/{発行日}/` または `{発行日}.threads.html` へ置く  
2. `fetch:kouhou` → `extract:kouhou`  
3. **`npm run extract:kuchikomi -- --date {発行日}`** → `data/kuchikomi/extracted/{発行日}/posts.json` と `posts.md`  
4. Step C: エージェントは **抽出済み構造化ファイル**を正として下書き（生 HTML を直接読まない）。無ければ待機  
5. 公開形は地域束＋**口コミ1文＋公式 oEmbed**。`embed.js` はレイアウトで 1 回  
6. **`npm run prose-review -- --vol N`**（[`scripts/prose-review-prompt.md`](../scripts/prose-review-prompt.md)）で声・工程メタ・1文・地域 h3 を直し  
7. 人間がファクトチェック → commit  

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

- **公式優先。** 口コミは声として距離を取る  
- **客の店紹介・食事口コミは採用可。** 本人（店）投稿は **宣伝が主目的のときだけ除外**（場面が軸なら可。号あたり店アカウントは少数）  
- **広報連動を優先。** 号の広報・ピックアップと催し名・会場が重なる口コミを先に拾う。無いときは無理に埋めない  
- **同話題:** 原則1件。広報連動の盛り上がりクラスタは最大3件（号の口コミの半分超は不可）  
- **ジャンル:** フード／イベント／季節／暮らしを見出しにせず、**県北／県央／県南の各地域内**で偏り防止（号全体だけで足りとしない）  
- **束ね:** `###` は **地域のみ**（必ず 県北 → 県央 → 県南）。テーマは **見出しにしない**  
- **広報トピックも同じ地域へ**（号の口コミ専用章にしない）  
- **口コミの置き場:** ピックアップ連動 → **そのピックアップ本文**（段落の切れ目が望ましい。1本あたり最大2。今週と重複禁止）。今週の広報連動 → 該当 `####` の直後。別話題 → 地域末尾の固定見出し **`#### 街の声`**（店名・催し名・テーマ語は h4 にしない。空なら作らない）  
- **並び:** 地域内は広報をテーマ順 → 同テーマ内は、直近 **降順**／今週のあきた **昇順** → 任意で `#### 街の声`  
- 口コミは **メディアの1文＋ embed**（embed だけの列挙にしない。「要約しました」口調禁止）  
- 禁止: 工程メタ、へッジ連打、未確認の事実断定  
- 出典例（embed ごと）:

```markdown
> 出典: 口コミ（Threads）  
> https://www.threads.com/@user/post/...
```

- 公式 oEmbed のマークアップは **記事 Markdown に載せる（portable）**。詳細: [`threads-citation-rules.md`](./threads-citation-rules.md)  
- 埋め込みは `<div class="threads-embed">` から `</blockquote></div>` まで含める（内側の `</div>` で切らない）。`npm run check:threads-embeds`  

## チェックリストとの関係

`npm run draft` は任意の URL 索引シェルを用意しうるが、**下書きの正本は extracted/posts.***。  
エージェントはネット取得せず、ローカル抽出物と（表示用の）公式 oEmbed だけを使う。  
下書き後は **`npm run prose-review`** で文章契約を回す（textlint の代替ではない）。
