# 品質チェック

ローカルと CI で使う品質チェックの詳細です。

```bash
npm run check:fast   # textlint / design / citations / md links
npm run build && npm run check:links:site && npm run check:a11y && npm run check:seo
npm run check        # 上記の一括（要 Playwright Chromium）
```

初回のみ a11y 用ブラウザ: `npx playwright install chromium`

Git hook: `simple-git-hooks` + `lint-staged`（`npm install` で有効化）。任意で [pre-commit](https://pre-commit.com/) も `.pre-commit-config.yaml` あり。

## 一覧

| チェック | ツール | 実行場所 | PR/`main` で失敗するか |
| :--- | :--- | :--- | :---: |
| 日本語校正 | textlint（ja-technical-writing、緩い設定）。対象は下記「Markdown 対象」 | CI + pre-commit | はい |
| リンク切れ | markdown-link-check（同 Markdown 対象。`nabecco.media` / `github.io` は無視しない）+ linkinator（preview 巡回） | CI（md は pre-commit も） | はい |
| デザイン禁止（カード枠ヒューリスティクス） | `scripts/check-design.mjs` | CI + pre-commit | はい |
| 出典の有無（構造） | `scripts/check-citations.mjs` | CI + pre-commit | はい |
| a11y | Playwright + axe（WCAG A/AA）＋ 375 / 1280 の横溢れスモーク | CI のみ | はい |
| SEO / OGP | `scripts/check-seo.mjs`（title / description / canonical / lang / og:* / twitter:card / robots / sitemap） | CI のみ | はい |
| ファクトチェック（LLM） | stub（`npm run factcheck`） | 手動 / `workflow_dispatch` のみ | **いいえ** |
| 文章の書き方（読み物・束ね・口コミ1文） | `npm run prose-review`（チェックリスト＋軽い禁則警告。textlint とは別） | 手動（下書き後・公開前） | **いいえ** |
| 公開不適合のざっくり検出 | `npm run check:public-content`（個人名・ホームパス等のヒューリスティック） | 手動（コミット／PR 前） | **いいえ** |

## 公開リポジトリに載せないもの

**公開リポジトリに載せるべきでないものは一切追跡ファイルに入れない。**

コミット／PR 前に次を確認します。

- 個人名や非公開のメール／電話、ホームパス、勤務先の非公開情報を追跡に入れない
- ローカル専用の補助設定・私的ヒューリスティック、生 HTML ダンプ、抽出 JSON、シークレットをコミットしない
- 私的な作業置き場や運用メモへの参照、ポータブル契約を超える工程メタを docs／スクリプトに書かない
- 記事の広報問い合わせ電話、選定した公開 Threads の embed、GA を Actions の vars 経由で渡すことなどは意図的な公開として可
- 迷ったら追跡から外す。機械チェックは漏れゼロ保証ではない

```bash
npm run check:public-content
```

`scripts/check-public-content.mjs` が `git ls-files` 対象をざっと見る。`.gitignore` の無視行や `package-lock.json` など既知の偽陽性は除外する。

## Markdown 対象（textlint / md リンク）

トップレベル `*.md`、`docs/` 配下、`src/content/` 配下の Markdown です。
パス一覧は `node scripts/markdown-paths.mjs` で確認できます。

### 文体と textlint

地の文（散文）は読者向け方針・説明では**ですます調**を基本とする（POLICY の本文など）。

箇条書きは例外とする。リスト項目は textlint の `no-mix-dearu-desumasu` に合わせ、**である調／体言止め**（「〜する／しない」など）でよい。散文と箇条の語尾を無理に揃えなくてよい。

## 補足

**ファクトチェックの限界:** 自動での真偽判定は行いません。実質的なガードは「まとまった本文セクションに URL または `> 出典` があること」と、公開前の人の確認（[POLICY.md](../POLICY.md)）です。プレースホルダ（「ここに書く」）は免除されます。

**文章の書き方チェック:** textlint では拾えないメディア声・工程メタ・地域のみ h3・口コミ1文などを、[`scripts/prose-review-prompt.md`](../scripts/prose-review-prompt.md) に沿って人が（またはエージェントが）直します。`npm run prose-review -- --vol N`。CI の合否には入れません。

**デザインチェックの対象:** 同一 CSS ルール内で `border-radius`（0 / 50% 以外）と箱型 `border` または `box-shadow` が同居するパターンを検出します。`border-top` などの直線のみは許容します。

**SEO / OGP の対象:** `/`・`/issues/`・`/issues/vol-1/` です。
`lang`、title、description、絶対 URL の canonical、`robots.txt`、`sitemap-index.xml` を見ます。
OGP は `og:title` / `og:description` / `og:type` / `og:url` / `og:image` / `og:locale` と `twitter:card` です。
共有画像は `public/og.png`（1200×630）。Lighthouse は使わず、ビルド後 HTML を直接検証します。
