# 口コミの記事反映（Phase 7.2）

広報3ステップに加え、街の声を号の読み物へ取り込む運用です。  
執筆契約の正本は [`scripts/draft-prompt.md`](../scripts/draft-prompt.md)。方針は [POLICY.md](../POLICY.md)。

## 設計判断（確定）

| 項目 | 判断 |
| :--- | :--- |
| 自動化レベル | **半手動**（初期）。SNS API 取得はまだ入れない |
| 入力 | 運営が **URL** を `data/kuchikomi/*.txt` に置く（注記は任意。共有シート → ローカル可） |
| いつ読むか | Step C（下書き）で広報抽出とあわせて読む。無くても号は書ける |
| 置き場 | 主に **今週のあきた**。題材がピックアップに耐えるときだけピックアップ候補にも可 |
| トーン | 現場感の補完。断定・煽り・宣伝偏重は禁止 |
| Git | 本番ファイルは gitignore。`example.txt` のみ追跡 |

完了条件（プラン）: 口コミが少なくとも1本の号フローで記事に反映でき、手順が文書化されていること。

## 週次の手順

1. 気になる Threads / Web 等の **URL** を手元にストックする
2. `data/kuchikomi/` に `.txt` を置く（1行1件。書式は下記）
3. 通常どおり `fetch:kouhou` → `extract:kouhou`
4. `npm run draft -- --vol N --date YYYY-MM-DD` で口コミファイル一覧を確認
5. エージェント／編集者が URL 先を踏まえ `draft-prompt.md` に従い `vol-N.md` へ反映
6. 人間がファクトチェック（URL 到達・誹謗中傷なし・断定しすぎない）→ commit

## 入力ファイル書式

`data/kuchikomi/example.txt` を踏襲します。

```text
# コメント行
https://example.com/post
https://example.com/other — （任意）短い注記
```

- 本番ファイル名は自由（例: `2026-11-01.txt`）。`*.txt` は gitignore
- **必須は URL のみ。** 注記は任意（負担をかけない）
- 誹謗中傷・個人特定・宣伝目的の偏った推挙は置かない（置いても記事に使わない）
- 記事用の要約はエージェントが URL を読んで下書きし、人間が確認する

## 記事への書き方（要約）

- 広報の一次情報と矛盾するときは、公式を優先し、口コミは「声」として距離を取る
- 出典例:

```markdown
> 出典: 口コミ（Web）  
> https://example.com/post
```

- 言い回し例: 「〜という投稿がある」「〜と伝える声がある」。未確認を事実断定しない
- 工程メタ（「口コミファイルから拾った」等）は本文に書かない

## チェックリストとの関係

`npm run draft` は `data/kuchikomi/*.txt`（example 含む）を一覧表示します。  
単一ファイルだけ見たいときは `--kuchikomi path` を渡せます。
