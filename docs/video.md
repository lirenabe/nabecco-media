# ニュース動画（音声＋静止画＋字幕）

週刊記事と（将来）広報要約を、ニュース読み上げ動画にするローカル工程です。サイトのビルドには含めません。YouTube 等への投稿用です。

## 方針

| 種類 | 開始 | 提供表記（画面左下） |
| :--- | :--- | :--- |
| 記事（weekly） | **vol.4 から** | `提供：なべっこ` |
| 広報（kouhou） | **2026年12月号から** | `提供：なべっこ（自治体広報をもとに要約）` |

- 映像は**完全静止**（ズーム・パンなし）
- 音声は Google Cloud Text-to-Speech（Cloud Console で発行した API キー）
- 字幕は焼き込み
- はめ込み写真は `data/video/stills/`（ローカル。gitignore）

## 配置

| パス | 内容 | Git |
| :--- | :--- | :--- |
| `scripts/video/build.py` | 生成スクリプト | 追跡 |
| `scripts/video/upload.py` | YouTube アップロード（予約公開可） | 追跡 |
| `data/video/scripts/` | 読み上げ原稿（`weekly-volN.txt` など） | 非追跡 |
| `data/video/stills/` | 右パネル用写真 | 非追跡 |
| `data/video/out/` | 完成 MP4 | 非追跡 |
| `data/video/work/` ほか | 中間生成物 | 非追跡 |
| `secrets/youtube/` | OAuth クライアント／トークン | 非追跡 |

## 前提

```bash
brew install ffmpeg
python3 -m pip install -r scripts/requirements-video.txt
```

`.env`（gitignore）:

```bash
GOOGLE_TTS_API_KEY=…
YOUTUBE_CLIENT_SECRETS=secrets/youtube/client_secret.json
YOUTUBE_TOKEN=secrets/youtube/token.json
```

TTS キーは [Cloud Console](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com) で Text-to-Speech API を有効化し、認証情報から API キーを作成します。

YouTube 投稿は OAuth が必要です。[YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) を有効化し、デスクトップ用 OAuth クライアント JSON を `secrets/youtube/client_secret.json` に置きます（`secrets/` は gitignore）。

## 使い方

```bash
# 読み上げ原稿を用意（セクションは --- 区切り、先頭行 # 見出し）
# data/video/scripts/weekly-vol4.txt

npm run video -- --kind weekly --vol 4 --eyebrow "第4号　2026年11月21日"

# 音声から作り直すとき
npm run video -- --kind weekly --vol 4 --eyebrow "第4号　2026年11月21日" --force-tts
```

出力: `data/video/out/weekly-vol4.mp4`

広報は 12 月号以降、`data/video/scripts/` に原稿を置いてから次を実行します。

```bash
npm run video -- --kind kouhou --script kouhou-….txt --eyebrow "○○市　2026年12月号"
```

（現状 `--kind kouhou` は `--script` 必須。運用開始後に引数を足してよい。）

## 原稿の型

```
# オープニング
なべっこニュースです。
…

---
# ヘッドライン1 …
本文。

---
# エンディング
…
```

セクション境界で短い無音を入れます。

## YouTube アップロード

```bash
python3 -m pip install -r scripts/requirements-video.txt

# 初回だけブラウザで同意 → secrets/youtube/token.json を保存
npm run video:auth

# 予約公開（JST で指定可。内部で UTC に変換）
npm run video:upload -- \
  --kind weekly --vol 4 \
  --publish-at "2026-12-01T18:00:00+09:00"

# 送信内容の確認のみ
npm run video:upload -- --kind weekly --vol 4 --publish-at "2026-12-01T18:00:00+09:00" --dry-run
```

- `--publish-at` あり → `privacy=private` 必須。指定時刻に公開
- デフォルト題名: `なべっこニュース 第N号`／概要にサイトと号 URL
- デフォルトで `containsSyntheticMedia` を立てる（TTS・AI ビジュアル想定）。不要なら `--no-synthetic`
- サムネは `--thumbnail path.jpg`（チャンネルの電話認証が必要な場合あり）
