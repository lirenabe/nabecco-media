# デプロイと DNS / HTTPS

## GitHub Pages

`main` への push、または Actions の手動実行でデプロイします。
ワークフローは Astro をビルドし、GitHub Pages へ公開します。
実装は `actions/deploy-pages` です（`.github/workflows/deploy.yml`）。

- Astro `site`: `nabecco.media`（`astro.config.mjs` の `site` URL）。カスタムドメインのため `base` は `/`
- `public/CNAME`: `nabecco.media`
- リポジトリ Settings → Pages → Source を **GitHub Actions** にする（初回のみ）

## DNS / HTTPS

`nabecco.media` の DNS はリポジトリ外で設定します。
現時点では A レコードは Pages に向いていますが、カスタムドメインの HTTPS 証明書が未整備なことがあります。
公開確認は [GitHub Pages URL](https://lirenabe.github.io/nabecco-media/) を使ってください。
証明書が有効になったら、README のサイトリンクを `https://nabecco.media/` に戻します。

README の入口からは、証明書が通るまで `nabecco.media` を直接リンクしない方針です。
