#!/usr/bin/env bash
# photoreal-image / generate.sh
# Sends a finished photoreal prompt to the best available photorealism model,
# saves the PNG + a .prompt.txt sidecar to ~/Downloads.
#
# Usage:
#   ./generate.sh --prompt-file FILE --slug short-description [options]
#
# Options:
#   --prompt-file FILE   File containing the full prompt (required)
#   --slug TEXT          kebab-case description for the filename (required)
#   --aspect RATIO       1:1 3:2 2:3 4:3 3:4 4:5 5:4 16:9 9:16 21:9  (default 16:9)
#   --size TIER          1K | 2K | 4K  (default 2K) — output resolution
#   --model NAME         auto | pro | gpt | draft | flux | legacy | <exact model id>
#                        (default auto = best photorealism first)
#   --quality LEVEL      low | medium | high  (default high; OpenAI models only)
#   --n COUNT            number of images, 1-4 (default 1)
#   --out-dir DIR        output directory (default ~/Downloads)
#   --dry-run            resolve provider/model and exit without spending
#
# Model map (July 2026):
#   pro    google/gemini-3-pro-image      Nano Banana Pro — best skin/material realism
#   gpt    openai/gpt-image-2             best literal prompt adherence + in-image text
#   draft  google/gemini-3.1-flash-image  cheap layout tests only; visibly less photoreal
#   flux   bfl/flux-2-pro                 optional, needs BFL_API_KEY
#   legacy openai/gpt-image-1, dall-e-3   old and plasticky; kept only for comparison
#
# Exit codes: 0 ok | 2 bad usage | 3 no provider available | 4 all providers failed
set -uo pipefail

PROMPT_FILE=""; SLUG=""; ASPECT="16:9"; SIZE="2K"; MODEL="auto"; QUALITY="high"; N=1
OUT_DIR="$HOME/Downloads"; DRY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --prompt-file) PROMPT_FILE="${2:-}"; shift 2 ;;
    --slug)        SLUG="${2:-}"; shift 2 ;;
    --aspect)      ASPECT="${2:-}"; shift 2 ;;
    --size)        SIZE="${2:-}"; shift 2 ;;
    --model)       MODEL="${2:-}"; shift 2 ;;
    --quality)     QUALITY="${2:-}"; shift 2 ;;
    --n)           N="${2:-}"; shift 2 ;;
    --out-dir)     OUT_DIR="${2:-}"; shift 2 ;;
    --dry-run)     DRY=1; shift ;;
    -h|--help)     sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "ERROR: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

# ---------- preflight ----------
command -v curl >/dev/null || { echo "ERROR: curl is required." >&2; exit 2; }
command -v jq   >/dev/null || { echo "ERROR: jq is required. Install with: brew install jq" >&2; exit 2; }
[ -n "$PROMPT_FILE" ] && [ -f "$PROMPT_FILE" ] || { echo "ERROR: --prompt-file must point to an existing file." >&2; exit 2; }
[ -s "$PROMPT_FILE" ] || { echo "ERROR: prompt file is empty." >&2; exit 2; }
[ -n "$SLUG" ] || { echo "ERROR: --slug is required." >&2; exit 2; }
case "$N" in ''|*[!0-9]*) echo "ERROR: --n must be a number." >&2; exit 2 ;; esac
[ "$N" -ge 1 ] && [ "$N" -le 4 ] || { echo "ERROR: --n must be 1-4." >&2; exit 2; }
case "$QUALITY" in low|medium|high) ;; *) echo "ERROR: --quality must be low, medium or high." >&2; exit 2 ;; esac
# Gemini rejects lowercase 'k'.
SIZE=$(printf '%s' "$SIZE" | tr '[:lower:]' '[:upper:]')
case "$SIZE" in 1K|2K|4K) ;; *) echo "ERROR: --size must be 1K, 2K or 4K." >&2; exit 2 ;; esac
case "$ASPECT" in
  1:1|3:2|2:3|4:3|3:4|4:5|5:4|16:9|9:16|21:9) ;;
  *) echo "ERROR: --aspect must be one of 1:1 3:2 2:3 4:3 3:4 4:5 5:4 16:9 9:16 21:9." >&2; exit 2 ;;
esac
mkdir -p "$OUT_DIR" || { echo "ERROR: cannot create $OUT_DIR" >&2; exit 2; }

SLUG=$(printf '%s' "$SLUG" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | sed -e 's/-\{2,\}/-/g' -e 's/^-//' -e 's/-$//')
[ -n "$SLUG" ] || SLUG="image"
STAMP=$(date +%Y%m%d-%H%M%S)

# base64 decode flag differs across BSD/GNU
if printf 'dGVzdA==' | base64 -d >/dev/null 2>&1; then B64D="-d"; else B64D="-D"; fi

# ---------- size mapping ----------
AR_W="${ASPECT%%:*}"; AR_H="${ASPECT##*:}"

# gpt-image-2 takes any size: both edges multiple of 16, max edge 3840,
# 655360 <= pixels <= 8294400. Derive w/h from the aspect at a target megapixel
# count so 16:9 and 21:9 don't fall under the pixel floor.
case "$SIZE" in 1K) TARGET_MP=1000000 ;; 2K) TARGET_MP=2500000 ;; 4K) TARGET_MP=8000000 ;; esac
GPT2_SIZE=$(awk -v ar="$AR_W" -v arh="$AR_H" -v mp="$TARGET_MP" 'BEGIN{
  r = ar/arh;
  w = sqrt(mp*r); h = sqrt(mp/r);
  if (w > 3840) { w = 3840; h = w/r }
  if (h > 3840) { h = 3840; w = h*r }
  w = int((w+8)/16)*16; h = int((h+8)/16)*16;
  if (w > 3840) w = 3840; if (h > 3840) h = 3840;
  while (w*h > 8294400) { w -= 16; h = int((w/r+8)/16)*16 }
  while (w*h < 655360)  { w += 16; h = int((w/r+8)/16)*16 }
  printf "%dx%d", w, h }')

# gpt-image-1 / 1.5 and DALL-E 3 only accept a fixed menu.
case "$ASPECT" in
  1:1)                  GPT_SIZE="1024x1024"; DALLE_SIZE="1024x1024" ;;
  9:16|2:3|3:4|4:5)     GPT_SIZE="1024x1536"; DALLE_SIZE="1024x1792" ;;
  *)                    GPT_SIZE="1536x1024"; DALLE_SIZE="1792x1024" ;;
esac
case "$QUALITY" in high) DALLE_QUALITY="hd" ;; *) DALLE_QUALITY="standard" ;; esac

# ---------- provider chain ----------
# Ordered BEST PHOTOREALISM FIRST, not cheapest first — this skill exists to
# produce photographs. Use --model draft when you deliberately want cheap.
CHAIN=""
case "$MODEL" in
  auto)
    [ -n "${GEMINI_API_KEY:-}" ] && CHAIN="google:gemini-3-pro-image"
    [ -n "${OPENAI_API_KEY:-}" ] && CHAIN="$CHAIN openai:gpt-image-2"
    [ -n "${GEMINI_API_KEY:-}" ] && CHAIN="$CHAIN google:gemini-3.1-flash-image" ;;
  pro)
    [ -n "${GEMINI_API_KEY:-}" ] && CHAIN="google:gemini-3-pro-image google:gemini-3-pro-image-preview" ;;
  gpt)
    [ -n "${OPENAI_API_KEY:-}" ] && CHAIN="openai:gpt-image-2 openai:gpt-image-1.5" ;;
  draft|flash)
    [ -n "${GEMINI_API_KEY:-}" ] && CHAIN="google:gemini-3.1-flash-image google:gemini-3.1-flash-lite-image"
    [ -n "${OPENAI_API_KEY:-}" ] && CHAIN="$CHAIN openai:gpt-image-1-mini" ;;
  flux)
    [ -n "${BFL_API_KEY:-}" ] && CHAIN="bfl:flux-2-pro" ;;
  legacy)
    [ -n "${OPENAI_API_KEY:-}" ] && CHAIN="openai:gpt-image-1 openai:dall-e-3" ;;
  dalle)
    [ -n "${OPENAI_API_KEY:-}" ] && CHAIN="openai:dall-e-3" ;;
  gemini*)            [ -n "${GEMINI_API_KEY:-}" ] && CHAIN="google:$MODEL" ;;
  gpt-image*|dall-e*) [ -n "${OPENAI_API_KEY:-}" ] && CHAIN="openai:$MODEL" ;;
  flux*)              [ -n "${BFL_API_KEY:-}" ] && CHAIN="bfl:$MODEL" ;;
  *) echo "ERROR: unknown --model '$MODEL'" >&2; exit 2 ;;
esac

if [ -z "${CHAIN// }" ]; then
  echo "NO_PROVIDER: no API key available for the requested model." >&2
  case "$MODEL" in
    flux) echo "--model flux needs BFL_API_KEY (https://dashboard.bfl.ai)." >&2 ;;
    *)    echo "Set GEMINI_API_KEY or OPENAI_API_KEY, or use the prompt manually." >&2 ;;
  esac
  exit 3
fi

if [ "$DRY" -eq 1 ]; then
  echo "Would try, in order:"; for e in $CHAIN; do echo "  - ${e%%:*} / ${e#*:}"; done
  echo "Aspect: $ASPECT | Size: $SIZE (gemini imageSize $SIZE, gpt-image-2 $GPT2_SIZE, legacy $GPT_SIZE)"
  echo "Quality: $QUALITY (OpenAI only) | Images: $N | Out: $OUT_DIR"
  exit 0
fi

TMP=$(mktemp -d "${TMPDIR:-/tmp}/photoreal.XXXXXX") || exit 2
trap 'rm -rf "$TMP"' EXIT

# ---------- providers ----------
# Each writes a decoded PNG to $TMP/out-N.png, or sets ERRMSG and returns 1.

gen_google() {
  model="$1"; idx="$2"
  # flash-lite tops out at 1K; ask for what the model can actually give.
  isize="$SIZE"
  case "$model" in *flash-lite*) isize="1K" ;; esac

  jq -n --rawfile p "$PROMPT_FILE" --arg ar "$ASPECT" --arg sz "$isize" '{
    contents: [{ parts: [{ text: $p }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: $ar, imageSize: $sz }
    }
  }' > "$TMP/req.json" || return 1

  code=$(curl -s -o "$TMP/resp.json" -w '%{http_code}' --max-time 600 \
    "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent" \
    -H "x-goog-api-key: $GEMINI_API_KEY" -H "Content-Type: application/json" \
    -d @"$TMP/req.json")
  if [ "$code" != "200" ]; then
    ERRMSG=$(jq -r '.error.message // "HTTP '"$code"'"' "$TMP/resp.json" 2>/dev/null | head -c 300)
    return 1
  fi
  jq -r 'first(.candidates[]?.content.parts[]? | select(.inlineData) | .inlineData.data) // empty' \
    "$TMP/resp.json" > "$TMP/b64" || return 1
  if [ ! -s "$TMP/b64" ]; then
    ERRMSG=$(jq -r '(.promptFeedback.blockReason // .candidates[0].finishReason // "no image in response")' "$TMP/resp.json" 2>/dev/null)
    return 1
  fi
  base64 $B64D < "$TMP/b64" > "$TMP/out-$idx.png" 2>/dev/null || return 1
  [ -s "$TMP/out-$idx.png" ] || return 1
}

gen_openai() {
  model="$1"; idx="$2"
  case "$model" in
    dall-e*)
      jq -n --rawfile p "$PROMPT_FILE" --arg s "$DALLE_SIZE" --arg m "$model" --arg q "$DALLE_QUALITY" \
        '{model:$m, prompt:$p, n:1, size:$s, quality:$q, response_format:"b64_json"}' > "$TMP/req.json" || return 1 ;;
    gpt-image-2*)
      # gpt-image-2 accepts arbitrary legal sizes, so honour --size properly.
      jq -n --rawfile p "$PROMPT_FILE" --arg s "$GPT2_SIZE" --arg m "$model" --arg q "$QUALITY" \
        '{model:$m, prompt:$p, n:1, size:$s, quality:$q}' > "$TMP/req.json" || return 1 ;;
    *)
      jq -n --rawfile p "$PROMPT_FILE" --arg s "$GPT_SIZE" --arg m "$model" --arg q "$QUALITY" \
        '{model:$m, prompt:$p, n:1, size:$s, quality:$q}' > "$TMP/req.json" || return 1 ;;
  esac

  code=$(curl -s -o "$TMP/resp.json" -w '%{http_code}' --max-time 600 \
    https://api.openai.com/v1/images/generations \
    -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" \
    -d @"$TMP/req.json")
  if [ "$code" != "200" ]; then
    ERRMSG=$(jq -r '.error.message // "HTTP '"$code"'"' "$TMP/resp.json" 2>/dev/null | head -c 300)
    return 1
  fi
  jq -r '.data[0].b64_json // empty' "$TMP/resp.json" > "$TMP/b64" || return 1
  if [ ! -s "$TMP/b64" ]; then
    url=$(jq -r '.data[0].url // empty' "$TMP/resp.json")
    [ -n "$url" ] || { ERRMSG="no image in response"; return 1; }
    curl -s --max-time 120 -o "$TMP/out-$idx.png" "$url" || return 1
  else
    base64 $B64D < "$TMP/b64" > "$TMP/out-$idx.png" 2>/dev/null || return 1
  fi
  [ -s "$TMP/out-$idx.png" ] || return 1
}

# Black Forest Labs is async: submit, poll, then download a 10-minute signed URL.
# Opt-in only (--model flux) and unverified — no BFL key was available to test it.
gen_bfl() {
  model="$1"; idx="$2"
  wh=$(awk -v s="$GPT2_SIZE" 'BEGIN{split(s,a,"x"); print a[1], a[2]}')
  set -- $wh
  jq -n --rawfile p "$PROMPT_FILE" --argjson w "$1" --argjson h "$2" \
    '{prompt:$p, width:$w, height:$h, output_format:"png"}' > "$TMP/req.json" || return 1

  code=$(curl -s -o "$TMP/resp.json" -w '%{http_code}' --max-time 120 \
    "https://api.bfl.ai/v1/$model" \
    -H "x-key: $BFL_API_KEY" -H "Content-Type: application/json" -d @"$TMP/req.json")
  if [ "$code" != "200" ]; then
    ERRMSG=$(jq -r '(.detail | if type=="array" then .[0].msg else . end) // .error // "HTTP '"$code"'"' "$TMP/resp.json" 2>/dev/null | head -c 300)
    return 1
  fi
  poll=$(jq -r '.polling_url // empty' "$TMP/resp.json")
  id=$(jq -r '.id // empty' "$TMP/resp.json")
  [ -n "$poll" ] || poll="https://api.bfl.ai/v1/get_result?id=$id"
  [ -n "$poll" ] || { ERRMSG="no polling url returned"; return 1; }

  tries=0
  while [ "$tries" -lt 90 ]; do
    curl -s --max-time 30 "$poll" -H "x-key: $BFL_API_KEY" -H "accept: application/json" > "$TMP/poll.json"
    st=$(jq -r '.status // empty' "$TMP/poll.json")
    case "$st" in
      Ready)
        sample=$(jq -r '.result.sample // empty' "$TMP/poll.json")
        [ -n "$sample" ] || { ERRMSG="Ready but no sample url"; return 1; }
        curl -s --max-time 180 -o "$TMP/out-$idx.png" "$sample" || return 1
        [ -s "$TMP/out-$idx.png" ] || { ERRMSG="download failed"; return 1; }
        return 0 ;;
      Error|Failed|"Request Moderated"|"Content Moderated")
        ERRMSG=$(jq -r '(.details|tostring) // .status' "$TMP/poll.json" | head -c 200); return 1 ;;
      "") ERRMSG="empty poll response"; return 1 ;;
    esac
    sleep 2
    tries=$((tries+1))
  done
  ERRMSG="timed out waiting for result"
  return 1
}

# ---------- run the chain ----------
USED=""; SAVED=""; FAILLOG=""
i=1
while [ "$i" -le "$N" ]; do
  ok=0
  for entry in $CHAIN; do
    prov="${entry%%:*}"; mdl="${entry#*:}"
    # Once a model succeeds, stay on it for the remaining images.
    [ -n "$USED" ] && [ "$USED" != "$mdl" ] && continue
    ERRMSG=""
    case "$prov" in
      google) gen_google "$mdl" "$i"; rc=$? ;;
      openai) gen_openai "$mdl" "$i"; rc=$? ;;
      bfl)    gen_bfl    "$mdl" "$i"; rc=$? ;;
      *)      ERRMSG="unknown provider"; rc=1 ;;
    esac
    if [ "$rc" -eq 0 ]; then USED="$mdl"; ok=1; break; fi
    FAILLOG="$FAILLOG
  $mdl: ${ERRMSG:-request failed}"
  done
  if [ "$ok" -ne 1 ]; then
    [ -n "$SAVED" ] && break   # keep whatever already succeeded
    echo "ERROR: every available model failed.$FAILLOG" >&2
    exit 4
  fi
  if [ "$N" -eq 1 ]; then dest="$OUT_DIR/image-$SLUG-$STAMP.png"; else dest="$OUT_DIR/image-$SLUG-$STAMP-$i.png"; fi
  mv "$TMP/out-$i.png" "$dest" || exit 4
  SAVED="$SAVED$dest
"
  i=$((i+1))
done

# Prompt sidecar: keeps the prompt reusable without dumping it into the transcript.
SIDECAR="$OUT_DIR/image-$SLUG-$STAMP.prompt.txt"
{
  echo "model: $USED"
  echo "aspect: $ASPECT"
  echo "size: $SIZE"
  case "$USED" in gpt-image*|dall-e*) echo "quality: $QUALITY" ;; esac
  echo "generated: $STAMP"
  echo "---"
  cat "$PROMPT_FILE"
} > "$SIDECAR"

printf '%s' "$SAVED" | sed '/^$/d' | while IFS= read -r f; do echo "Saved: $f"; done
echo "Prompt: $SIDECAR"
echo "Model: $USED"
[ -n "$FAILLOG" ] && echo "Fell back after:$FAILLOG" >&2
exit 0
