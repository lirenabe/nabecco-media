#!/usr/bin/env bash
# Wire the photoreal-image skill into every agent on this machine.
#
# Design: ONE canonical copy at ~/.agents/skills/photoreal-image. Everything else
# is a symlink or a short pointer, so editing the SKILL.md updates every agent at
# once. Nothing is duplicated, so nothing can drift.
#
# Safe to re-run. Each pointer lives between HTML comment markers; a re-run
# replaces the old block instead of appending a second one.
# To uninstall: ./install-everywhere.sh --remove
set -uo pipefail

SKILL_DIR="$HOME/.agents/skills/photoreal-image"
BEGIN="<!-- photoreal-image:begin -->"
END="<!-- photoreal-image:end -->"
REMOVE=0
[ "${1:-}" = "--remove" ] && REMOVE=1

[ -f "$SKILL_DIR/SKILL.md" ] || { echo "ERROR: canonical skill not found at $SKILL_DIR" >&2; exit 1; }

pointer_block() {
  cat <<EOF
$BEGIN
## Skill: photorealistic images

When asked to generate or create a **photorealistic photo or image** — or any image that
must look like a real camera captured it ("photorealistic", "realistic photo",
"hyperrealistic", "cinematic still", "product photo", "make it look real") — read
\`$SKILL_DIR/SKILL.md\` first and follow it. Do not write the image prompt without it: it
defines the required 10-block prompt structure, the draft-critique-final loop, and the
generator command.

    $SKILL_DIR/generate.sh --prompt-file FILE --slug NAME [--aspect 16:9] [--size 1K|2K|4K] [--model auto|pro|gpt|draft]

(Also on PATH as \`photoreal-image\`.) For illustrations, logos, diagrams, charts or social
graphics, this skill does not apply — proceed normally.
$END
EOF
}

# Strip any existing block, then drop trailing blank lines. Portable awk, no GNU deps.
strip_block() {
  awk -v b="$BEGIN" -v e="$END" '
    $0==b {skip=1} !skip {a[++n]=$0} $0==e {skip=0}
    END { last=n; while (last>0 && a[last]=="") last--; for (i=1;i<=last;i++) print a[i] }
  ' "$1"
}

wire() {  # wire <file> <label>
  file="$1"; label="$2"
  mkdir -p "$(dirname "$file")" 2>/dev/null
  # Follow symlinks so we edit the real file, not the link.
  target="$file"
  while [ -L "$target" ]; do
    link=$(readlink "$target")
    case "$link" in /*) target="$link" ;; *) target="$(dirname "$target")/$link" ;; esac
  done
  [ -f "$target" ] || : > "$target"
  if grep -qF "$BEGIN" "$target" 2>/dev/null; then
    strip_block "$target" > "$target.tmp" && mv "$target.tmp" "$target"
    action="updated"
  else
    action="added"
  fi
  if [ "$REMOVE" -eq 1 ]; then
    printf '  %-34s removed\n' "$label"
    return
  fi
  [ -s "$target" ] && printf '\n' >> "$target"
  pointer_block >> "$target"
  # Cursor rule files need frontmatter to be picked up when dropped into a project.
  case "$target" in
    *.mdc)
      if ! head -1 "$target" | grep -q '^---$'; then
        { printf -- '---\ndescription: Photorealistic photo and image generation\nalwaysApply: true\n---\n\n'; cat "$target"; } > "$target.tmp" && mv "$target.tmp" "$target"
      fi ;;
  esac
  printf '  %-34s %s\n' "$label" "$action"
}

echo "Canonical skill: $SKILL_DIR"
echo
echo "Native skill discovery (no pointer needed):"
# Relative link, matching the style of the sibling skills already in that directory.
mkdir -p "$HOME/.claude/skills"
ln -sfn "../../.agents/skills/photoreal-image" "$HOME/.claude/skills/photoreal-image" 2>/dev/null \
  && printf '  %-34s linked\n' "Claude Code (~/.claude/skills)"
printf '  %-34s auto-scans ~/.agents/ and ~/.claude/\n' "OpenCode"
mkdir -p "$HOME/.local/bin"
if [ "$REMOVE" -eq 1 ]; then
  rm -f "$HOME/.local/bin/photoreal-image" "$HOME/.claude/skills/photoreal-image"
  printf '  %-34s removed\n' "PATH shim + claude link"
else
  ln -sfn "$SKILL_DIR/generate.sh" "$HOME/.local/bin/photoreal-image"
  printf '  %-34s ~/.local/bin/photoreal-image\n' "Shell (any agent)"
fi

echo
echo "Pointer-based (single global instruction file):"
# ~/AGENTS.md is the cross-agent standard; on this machine CLAUDE.md and Agent.md
# are symlinks to the same file, so one edit covers all three names.
wire "$HOME/AGENTS.md"            "AGENTS.md (Codex/Cursor/Amp…)"
wire "$HOME/.codex/AGENTS.md"     "Codex global (~/.codex)"
wire "$HOME/.gemini/GEMINI.md"    "Gemini CLI (~/.gemini)"
wire "$HOME/.cursor/rules/photoreal-image.mdc" "Cursor user rules"

echo
if [ "$REMOVE" -eq 1 ]; then
  echo "Removed. The canonical skill at $SKILL_DIR was left in place."
else
  cat <<EOF
Done. To add another agent later, append its global instruction file to the
wire() list above and re-run. To pull everything out: $0 --remove

Not wireable from the CLI:
  - Cursor's built-in "User Rules" box (Settings > Rules) is stored in Cursor's
    own database. Paste the block from ~/.cursor/rules/photoreal-image.mdc there,
    or copy that file into a project's .cursor/rules/ directory as-is.
  - Web-based agents (ChatGPT, Claude.ai) have no filesystem access. Use the
    portable single-file export instead: ~/Downloads/photoreal-image-skill.md
EOF
fi
