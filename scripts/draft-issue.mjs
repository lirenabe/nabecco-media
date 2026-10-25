#!/usr/bin/env node
/**
 * Draft checklist helper — no external LLM API.
 *
 * Assembles paths and a short checklist for *any* agent (Cursor today by
 * operator policy). Does not call Cursor SDK/APIs or vendor models.
 *
 * I/O contract (see scripts/draft-prompt.md):
 *   in:  data/kouhou/ PDFs, optional data/kuchikomi/, POLICY.md, municipalities.yaml
 *   out: src/content/posts/vol-N.md (written by the agent / human, not this CLI)
 *
 * A future OpenAI/Anthropic/Gemini adapter could plug in behind the same
 * contract (e.g. scripts/lib/draft-adapter.mjs) without rewriting fetch/YAML.
 *
 * Usage:
 *   npm run draft -- --vol 2 --date 2026-11-01
 *   npm run draft -- --vol 2 --date 2026-11-01 --print-prompt
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadSources } from './lib/sources.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PROMPT_REL = 'scripts/draft-prompt.md';

function parseArgs(argv) {
  const opts = {
    vol: null,
    date: null,
    kuchikomi: path.join(ROOT, 'data/kuchikomi/example.txt'),
    pdfDir: path.join(ROOT, 'data/kouhou'),
    printPrompt: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--vol') opts.vol = Number(argv[++i]);
    else if (a === '--date') opts.date = argv[++i];
    else if (a === '--kuchikomi') opts.kuchikomi = path.resolve(argv[++i]);
    else if (a === '--pdf-dir') opts.pdfDir = path.resolve(argv[++i]);
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

async function listPdfs(dir) {
  try {
    const names = await readdir(dir);
    const out = [];
    for (const name of names) {
      if (!/\.pdf$/i.test(name)) continue;
      const abs = path.join(dir, name);
      const st = await stat(abs);
      if (st.isFile() && st.size > 0) out.push({ name, abs, size: st.size });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
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
  Prints a draft checklist and paths. No LLM API calls.
  Full instructions: ${PROMPT_REL}`);
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
  const { sources } = await loadSources();
  const pdfs = await listPdfs(opts.pdfDir);
  const kuchikomiOk = await fileExists(opts.kuchikomi);
  const promptAbs = path.join(ROOT, PROMPT_REL);

  if (opts.printPrompt) {
    process.stdout.write(await readFile(promptAbs, 'utf8'));
    process.stdout.write('\n');
  }

  console.log('=== nabecco draft checklist (no LLM API) ===\n');
  console.log(`Target title : ${title}`);
  console.log(`pubDate      : ${opts.date}`);
  console.log(`vol          : ${opts.vol}`);
  console.log(`Output       : ${outRel}${await fileExists(outAbs) ? ' (exists — review before overwrite)' : ' (new)'}`);
  console.log(`Instructions : ${PROMPT_REL}`);
  console.log(`Policy       : POLICY.md`);
  console.log(`Sources YAML : sources/municipalities.yaml (${sources.length} entries)`);
  console.log(`PDF dir      : ${path.relative(ROOT, opts.pdfDir)} (${pdfs.length} file(s))`);
  console.log(
    `口コミ        : ${path.relative(ROOT, opts.kuchikomi)}${kuchikomiOk ? '' : ' (missing — optional)'}`,
  );

  if (!pdfs.length) {
    console.log('\n⚠ No PDFs found. Run first:\n  npm run fetch:kouhou\n');
  } else {
    console.log('\nPDFs:');
    for (const p of pdfs) {
      const id = p.name.split('_')[1] || '';
      const src = sources.find((s) => s.id === id);
      const label = src ? src.name : id || '—';
      console.log(`  - ${p.name}  (${label}, ${p.size} bytes)`);
    }
  }

  console.log(`
Next (operator / any agent — Cursor by current policy):
  1. Read ${PROMPT_REL} and POLICY.md
  2. Use the PDFs (+ optional口コミ) above as the only evidence
  3. Write ${outRel} with citations; no H1 in body
  4. Human review → npm run check → git commit / push (never auto-publish)

Note: This CLI does not generate article text and does not call vendor APIs.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
