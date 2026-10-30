# 口コミの記事反映（Phase 7.2）

広報3ステップに加え、街の声を号の読み物へ取り込む運用です。  
執筆契約の正本は [`scripts/draft-prompt.md`](../scripts/draft-prompt.md)。方針は [POLICY.md](../POLICY.md)。

## 設計判断（確定）

| 項目 | 判断 |
| :--- | :--- |
| 自動化レベル | **半手動**（初期）。SNS API 取得はまだ入れない |
| ファイル名 | **`data/kuchikomi/YYYY-MM-DD.txt`**（号の発行日 = `pubDate`） |
| 入力 | **URL 必須**、注記は任意 |
| Step C | エージェントがシェル作成 → **Kenta の URL 投入をチャットで待つ** → 下書き |
| 置き場 | 主に **今週のあきた**。ピックアップはゲートを満たすときのみ |
| トーン | 現場感の補完。断定・煽り・宣伝偏重は禁止 |
| Git | 本番ファイルは gitignore。`example.txt` のみ追跡 |

完了条件（プラン）: 口コミが少なくとも1本の号フローで記事に反映でき、手順が文書化されていること。

## 週次の手順（create → wait → draft）

1. （Kenta）気になる投稿の URL をストックする  
2. `fetch:kouhou` → `extract:kouhou`  
3. **Step C 開始:** `npm run draft -- --vol N --date YYYY-MM-DD`  
   - スクリプトが `data/kuchikomi/YYYY-MM-DD.txt` を無ければ作成（コメントだけのシェル）  
4. **待機:** エージェントはチャットでパスを伝え、Kenta が URL を書くか「なし」と言うまで **本文執筆に進まない**  
5. 再開後、URL があれば先を読んで `vol-N.md` へ反映。なければ広報のみ  
6. 人間がファクトチェック → commit  

### 待機の合図

- **主:** チャット一時停止（エージェントが止めて Kenta の返信を待つ）  
- **補助:** ファイルに `http` 行がある＝投入済みの目安。コメントのみ／空は未投入。URL の捏造禁止  

## 入力ファイル書式

```text
# kuchikomi shell for pubDate YYYY-MM-DD — add one URL per line (notes optional)
https://example.com/post
https://example.com/other — （任意）短い注記
```

- **必須は URL のみ。** 注記は任意  
- 誹謗中傷・個人特定・宣伝偏重は置かない（置いても記事に使わない）  
- 記事用の要約はエージェントが URL を読んで下書きし、人間が確認する  

## 記事への書き方（要約）

- 公式と矛盾するときは公式優先。口コミは「声」として距離を取る  
- 出典例:

```markdown
> 出典: 口コミ（Web）  
> https://example.com/post
```

- 言い回し例: 「〜という投稿がある」。未確認を事実断定しない  
- 工程メタ（「口コミファイルから拾った」等）は本文に書かない  

## チェックリストとの関係

`npm run draft` は発行日シェルを作成（既存なら触らない）し、`data/kuchikomi/*.txt` を一覧表示します。  
`--kuchikomi path` で単一ファイル指定もできます。
