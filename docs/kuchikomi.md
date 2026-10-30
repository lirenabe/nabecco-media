# 口コミの記事反映（Phase 7.2）

広報3ステップに加え、街の声を号の読み物へ取り込む運用です。  
執筆契約: [`scripts/draft-prompt.md`](../scripts/draft-prompt.md)。方針: [POLICY.md](../POLICY.md)。  
**Threads の取得・掲載制約:** [`threads-citation-rules.md`](./threads-citation-rules.md)（エージェントは `threads.com` を fetch しない）。

## 設計判断（確定）

| 項目 | 判断 |
| :--- | :--- |
| 自動化レベル | **半手動**。SNS API／エージェント fetch はしない |
| 主入力 | 人がブラウザで保存した HTML（発行日）: **`…/YYYY-MM-DD.threads.html`** または **`…/YYYY-MM-DD/*.html`**（`_files/` 可） |
| 任意入力 | `data/kuchikomi/YYYY-MM-DD.txt`（URL 索引。1行1 URL、注記任意） |
| Step C | ローカル HTML（＋任意 txt）のみ読む → 言い換え下書き |
| 公開形 | **短い言い換え／要約 ＋ パーマリンク**。HTML 丸ごと転載・画像再掲なし |
| 置き場 | 主に **今週のあきた** |
| Git | `*.threads.html` / 本番 `*.txt` は **gitignore**（`example.txt` のみ追跡） |

## 週次の手順（drop → wait → draft）

1. （Kenta）Threads 保存リスト等をブラウザで開き、HTML をエクスポート  
2. `data/kuchikomi/{発行日}.threads.html` に置く（任意で同日の `.txt` に URL 一覧）  
3. `fetch:kouhou` → `extract:kouhou`  
4. Step C: エージェントは HTML パスを確認。無ければ **チャットで待機**（fetch で埋めない）  
5. ローカルファイルだけを材料に `vol-N.md` へ反映  
6. 人間がファクトチェック → commit  

### 待機の合図

- **主:** チャット一時停止（「置いた」「なし」の返信を待つ）  
- **補助:** `.threads.html` の有無。空の `.txt` だけでは Threads 本文は読めない  

## 入力パス例

```text
data/kuchikomi/2026-11-01/保存済み ….html   # 主（ブラウザ「ページを保存」、gitignore）
data/kuchikomi/2026-11-01.threads.html     # 主の別形（単一 HTML でも可）
data/kuchikomi/2026-11-01.txt              # 任意の URL 索引（gitignore）
```

## 記事への書き方（要約）

- 公式と矛盾するときは公式優先。口コミは声として距離を取る  
- 出典例:

```markdown
> 出典: 口コミ（Threads）  
> https://www.threads.com/@user/post/...
```

- 言い換え中心。未確認を事実断定しない  
- 工程メタ／「HTML から拾った」等は本文に書かない  
- 詳細・禁止事項: [`threads-citation-rules.md`](./threads-citation-rules.md)

## チェックリストとの関係

`npm run draft` は任意の発行日 `.txt` シェルを用意しうるが、**Threads 本文の根拠は `.threads.html`**。  
エージェントはネット取得せず、ドロップされたローカルファイルだけを使う。
