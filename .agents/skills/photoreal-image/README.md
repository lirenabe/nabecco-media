# Photoreal Image — an agent skill

> Generate images that read as **photographs**, not AI renders — via a disciplined
> 10-block prompt contract and a multi-provider generator with a draft → critique → final loop.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Agent Skill](https://img.shields.io/badge/type-agent%20skill-6E56CF.svg)](./SKILL.md)
[![Works with Claude Code](https://img.shields.io/badge/works%20with-Claude%20Code-D97757.svg)](https://claude.com/claude-code)

This is a **skill for AI coding agents** (Claude Code, Codex, Cursor, Gemini CLI, OpenCode, and
anything that reads an `AGENTS.md` / `SKILL.md`). It teaches the agent *how a photographer thinks*
so that "make a photorealistic image of X" produces a considered frame instead of a generic,
plastic-looking one — then hands it a script that routes the finished prompt to the best
photorealism model available on your API keys.

---

## Why it exists

A short request ("AC repair scene, from inside the unit") produces a generic image. The same
request expanded into the **physical facts a camera would have recorded** produces a photograph.
Expanded into the **decisions a photographer would have made**, it produces a good one.

The skill is built on two axes:

- **Truth** — would a camera have recorded this? (Named lens, named light, named material, named flaw.)
- **Merit** — is this frame worth looking at? (One moment, one light idea, one detail that could be nowhere else.)

Realism comes from *constraint*, not adjectives — `photorealistic, 8k, ultra-detailed` is noise.
Merit comes from *commitment* to a single idea. The skill enforces both.

## What's in the box

| File | Purpose |
|---|---|
| `SKILL.md` | The skill itself — philosophy, the 10-block prompt contract, workflow, model matrix, and a mistakes table. This is what the agent reads. |
| `generate.sh` | Sends a finished prompt to the best available model and saves the PNG + a `.prompt.txt` sidecar. Handles provider fallback, sizing math, and dry-runs. |
| `references/craft.md` | Vocabulary banks (lenses, light, materials) and a full worked example. |
| `references/looks.md` | Presets, photographer/DP references, film stocks, and clichés to avoid. |
| `references/critique.md` | The scoring rubric the agent uses to judge each draft. |
| `install-everywhere.sh` | Wires the skill into every agent on your machine from one canonical copy. |

## The 10-block prompt contract (at a glance)

Each block is one paragraph of prose (not `key: value`), in order. Full detail lives in `SKILL.md`.

1. **Frame** — medium, subject, action, where the camera stands
2. **Moment** — the *instant*, not the activity
3. **Light** — hour/season/weather, every source, key-to-fill ratio in stops, the light *idea*
4. **Camera** — height, lens, aperture, rendering character, plane of focus
5. **Composition** — foreground/midground/background, subject separation, edge discipline
6. **Environment** — real objects across all three planes, including one that doesn't serve the picture
7. **Subject truth** — garments, human physics; or materials & surfaces
8. **Imperfections** — 5+ concrete flaws *(never skip — this is what stops it reading as CGI)*
9. **Punctum** — one small, faintly irrational detail that makes this frame *this* frame
10. **Palette, grade & reference** — a colour *relationship*, a named stock, then the negative list

> 📄 See a complete ~400-word worked example — a short "AC repair scene" request expanded into all
> ten blocks — in **[`references/craft.md`](./references/craft.md#worked-example)**.

## Requirements

- **`curl`** and **`jq`** (`brew install jq`)
- At least one image-model API key exported in your shell:
  - `GEMINI_API_KEY` — for `gemini-3-pro-image` (Nano Banana Pro), the default photoreal model
  - `OPENAI_API_KEY` — for `gpt-image-2` (best in-image text / literal prompt adherence)
  - `BFL_API_KEY` — *optional*, for `flux-2-pro`

No key? The skill still works — the agent produces the finished prompt as the deliverable for you
to paste into any tool.

## Install as an agent skill

The included installer keeps **one canonical copy** and symlinks/points every agent at it, so
editing `SKILL.md` updates them all. Clone into the canonical location and run it:

```bash
git clone https://github.com/olegspiridonovdev-spec/photoreal-image-skill.git \
  ~/.agents/skills/photoreal-image

~/.agents/skills/photoreal-image/install-everywhere.sh      # wire into every agent
# ~/.agents/skills/photoreal-image/install-everywhere.sh --remove   # to undo
```

That links it into Claude Code (`~/.claude/skills`), puts `photoreal-image` on your `PATH`, and
adds a pointer block to `AGENTS.md` / `GEMINI.md` / Cursor rules. **Claude Code / OpenCode users**
can skip the installer entirely — dropping this folder into `~/.claude/skills/photoreal-image` is
enough for native discovery.

## Use the generator directly

You don't need an agent to use the script:

```bash
# 1. Put a finished prompt in a file (see references/craft.md for the shape)
# 2. Render two drafts on the model you'll finish with:
~/.agents/skills/photoreal-image/generate.sh \
  --prompt-file /path/to/prompt.txt --slug ac-repair-interior \
  --aspect 16:9 --n 2 --model pro --size 2K

# 3. Final render of the winner:
~/.agents/skills/photoreal-image/generate.sh \
  --prompt-file /path/to/prompt.txt --slug ac-repair-interior \
  --model pro --size 2K --n 1
```

| Flag | Values | Default |
|---|---|---|
| `--model` | `auto` · `pro` · `gpt` · `draft` · `flux` · `legacy` · exact id | `auto` (best photoreal first) |
| `--aspect` | `1:1 3:2 2:3 4:3 3:4 4:5 5:4 16:9 9:16 21:9` | `16:9` |
| `--size` | `1K` · `2K` · `4K` | `2K` |
| `--n` | `1`–`4` | `1` |
| `--out-dir` | any directory | `~/Downloads` |
| `--dry-run` | resolve provider/model and exit without spending | — |

Run `generate.sh --help` for the full list. Output lands in `~/Downloads` as
`image-<slug>-<timestamp>.png` with the prompt saved beside it.

## Related

- **[cinematic-video-skill](https://github.com/olegspiridonovdev-spec/cinematic-video-skill)** — the
  motion counterpart: live-action video from Veo 3.1 / Sora 2 / Runway, with a 12-block shot contract.
  Make the still here, then animate the winner there.

## License

[MIT](./LICENSE) © 2026 Oleg Spiridonov. Contributions and issues welcome.
