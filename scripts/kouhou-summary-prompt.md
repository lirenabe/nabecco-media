# 参照層（広報の号ページ）要約契約

Step B の抽出物を読み、追跡ファイル `src/content/posts` ではなく **`src/content/kouhou/<muniId>__<yyyy-mm>.md`** を書く。
外部 LLM API をリポジトリのスクリプトから呼ばない。エージェントが本契約に従い本文を書く（Step C と同じ運用モデル）。

```bash
npm run extract:kouhou
npm run generate:kouhou-pages            # frontmatter・出典シェルを用意し、チェックリストを表示
# → エージェントが本ファイルに従い本文・events を書く
# → npm run check:textlint / 必要なら個別修正
```

## 入力

- `data/kouhou/extracted/<muniId>/text.txt`（または `content.md`）と `meta.json`
- `sources/municipalities.yaml` の `listingUrl` / 名称
- 既存の `src/content/kouhou/<muniId>__<yyyy-mm>.md` があれば frontmatter を維持して本文を差し替える

文字化け・CID 化け・重複行・柱・ノンブルだらけの断片は**要約に使わない**。読めない箇所は省略する（「抽出失敗」と書かない）。

## 出力（frontmatter）

```yaml
---
title: "{自治体名} 広報 {YYYY}年{M}月号"   # No. が分かれば末尾に（No.N）
description: "{自治体名}の公式広報 {YYYY}年{M}月号の要約です。"
muniId: city-...
muniName: "…"
yearMonth: "YYYY-MM"
issueNo: ""          # 分かれば数字のみ
listingUrl: "…"
sourceUrl: "…"       # PDF または公式号ページ
sha256: "…"          # meta にあれば
generatedAt: "ISO-8601"
events: []           # 下記。無ければ空配列のまま
---
```

### events

読者の役に立つ**これから／号内で案内されている催し・期限**だけを入れる。ノイズ行は入れない。

```yaml
events:
  - when: "2026年11月4日〜13日"   # 分かる範囲で具体的に
    what: "教育・保育施設等の入園申込"
    where: ""                      # 場所が広報にあれば
    contact: ""                    # 部署＋固定電話のみ。携帯は書かない
```

過去の報告記事だけの日付はイベントにしない。曖昧なら `events: []`。

## 本文構成

必ず入れる項目は次のとおりです。

1. 原本確認の `<aside class="info-note" role="note">`（定型文はシェルどおりでよい）
2. `## 出典`（公式案内リンク＋ PDF リンク）

内容があるときだけ入れる（**空なら章ごと省略**。失敗メッセージ・プレースホルダは禁止）。

- `## この号の案内` — 主要トピックの短い箇条書き（5〜15 件目安。読めない目次は作らない）
- `## 内容の要約` — `###` 見出し＋ですますの要約段落。網羅寄りだが、文字化け箇所・私人欄は書かない

禁止する文言・章は次のとおりです。

- 「機械抽出できませんでした」「原本の目次をご確認ください」など工程・失敗メタ
- 「抽出」「スキップ」「要確認」など運営向けメモ
- 空の `## この号の案内` / 空の `## 内容の要約`

## プライバシー（POLICY §6）

- 私人の氏名、070/080/090 は載せない
- 叙勲・出生・お悔やみ・戸籍の窓は載せない（章ごと省略）
- 公職者の氏名＋肩書は広報に出ている範囲で可
- 問い合わせは部署・団体＋公開固定電話のみ

## 文体

- ですます調
- 広報の丸写し禁止。意味の通る日本語に要約する
- textlint（ja-technical-writing）対象。句点・文長・半角カナに注意
- 画像は埋め込まない

## 完了条件

- [ ] 各対象ファイルで、案内または要約の少なくとも一方に読める内容がある（両方空は不可。読めない PDF のみ出典＋注記でも可だが、その場合は案内・要約章を付けない）
- [ ] 失敗・工程メタの文言がない
- [ ] `events` にゴミ行がない
- [ ] `npm run check:textlint` が通る（kouhou 含む）
- [ ] 人間がざっと確認してから commit
