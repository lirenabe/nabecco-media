#!/usr/bin/env node
/**
 * Step C checklist helper — no external LLM API.
 *
 * Prints paths for *any* agent (Cursor today by operator policy).
 * Prefers data/kouhou/extracted/<id>/ artifacts from Step B.
 *
 * Usage:
 *   npm run draft -- --vol 2 --date 2026-11-01
 *   npm run draft -- --vol 2 --date 2026-11-01 --print-prompt
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { extractDirRel, loadManifest } from './lib/manifest.mjs';
import { loadSources } from './lib/sources.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PROMPT_REL = 'scripts/draft-prompt.md';

function parseArgs(argv) {
  const opts = {
    vol: null,
    date: null,
    kuchikomi: path.join(ROOT, 'data/kuchikomi/example.txt'),
    printPrompt: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--vol') opts.vol = Number(argv[++i]);
    else if (a === '--date') opts.date = argv[++i];
    else if (a === '--kuchikomi') opts.kuchikomi = path.resolve(argv[++i]);
    else if (a === '--print-prompt') opts.printPrompt = true;
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function formatTitle(vol, dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid --date ${dateStr} (use YYYY-MM-DD)`);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `第${vol}号 ${y}年${m}月${day}日`;
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/draft-issue.mjs --vol N --date YYYY-MM-DD [--print-prompt]
  Step C checklist. Full instructions: ${PROMPT_REL}`);
    process.exit(0);
  }
  if (!opts.vol || !opts.date) {
    console.error('Required: --vol <n> --date YYYY-MM-DD');
    console.error(`See ${PROMPT_REL}`);
    process.exit(1);
  }

  const title = formatTitle(opts.vol, opts.date);
  const outRel = path.join('src/content/posts', `vol-${opts.vol}.md`);
  const outAbs = path.join(ROOT, outRel);
  const { sources, root } = await loadSources();
  const { doc: manifest } = await loadManifest(root);
  const kuchikomiOk = await fileExists(opts.kuchikomi);

  if (opts.printPrompt) {
    process.stdout.write(await readFile(path.join(ROOT, PROMPT_REL), 'utf8'));
    process.stdout.write('\n');
  }

  const extracted = [];
  for (const s of sources) {
    const entry = manifest.sources?.[s.id];
    const dirRel = entry?.extractPath || extractDirRel(s.id);
    const textAbs = path.join(root, dirRel, 'text.txt');
    if (await fileExists(textAbs)) {
      let images = 0;
      try {
        const imgs = await readdir(path.join(root, dirRel, 'images'));
        images = imgs.filter((n) => !n.startsWith('.')).length;
      } catch {
        /* no images dir */
      }
      extracted.push({
        id: s.id,
        name: s.name,
        dir: dirRel,
        sha256: entry?.sha256 || '',
        images,
      });
    }
  }

  console.log('=== nabecco draft checklist (Step C — no LLM API) ===\n');
  console.log(`Target title : ${title}`);
  console.log(`pubDate      : ${opts.date}`);
  console.log(`vol          : ${opts.vol}`);
  console.log(`Output       : ${outRel}${await fileExists(outAbs) ? ' (exists — review before overwrite)' : ' (new)'}`);
  console.log(`Instructions : ${PROMPT_REL}`);
  console.log(`Policy       : POLICY.md`);
  console.log(`Manifest     : data/kouhou/manifest.json`);
  console.log(`Extracted    : ${extracted.length} dir(s) under data/kouhou/extracted/`);
  console.log(
    `口コミ        : ${path.relative(ROOT, opts.kuchikomi)}${kuchikomiOk ? '' : ' (missing — optional)'}`,
  );

  if (!extracted.length) {
    console.log(`\n⚠ No extracts found. Run Steps A then B:\n  npm run fetch:kouhou\n  npm run extract:kouhou\n`);
  } else {
    console.log('\nPrimary inputs (prefer these over raw PDFs):');
    for (const e of extracted) {
      const short = e.sha256 ? e.sha256.slice(0, 12) : '—';
      console.log(`  - ${e.dir}/text.txt  (${e.name}, sha ${short}…, images=${e.images})`);
    }
  }

  console.log(`
Next (operator / any agent — Cursor by current policy):
  1. Read ${PROMPT_REL} and POLICY.md
  2. Skim extracted text/images above (PDF only for spot-check)
  3. Write ${outRel} with citations; no H1 in body
  4. Human review → npm run check → git commit / push (never auto-publish)
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
