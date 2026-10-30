#!/usr/bin/env node
/**
 * Step C checklist helper — no external LLM API.
 *
 * Prints paths for *any* agent (Cursor today by operator policy).
 * Prefers data/kouhou/extracted/<id>/ artifacts from Step B.
 * Lists human-exported Threads HTML dumps (+ optional *.txt URL index).
 *
 * Usage:
 *   npm run draft -- --vol 2 --date 2026-11-01
 *   npm run draft -- --vol 2 --date 2026-11-01 --print-prompt
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractDirRel, loadManifest } from './lib/manifest.mjs';
import { loadSources } from './lib/sources.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PROMPT_REL = 'scripts/draft-prompt.md';
const KUCHIKOMI_DIR = path.join(ROOT, 'data/kuchikomi');

function issueKuchikomiPath(dateStr) {
  return path.join(KUCHIKOMI_DIR, `${dateStr}.txt`);
}

async function ensureIssueKuchikomiShell(dateStr) {
  await mkdir(KUCHIKOMI_DIR, { recursive: true });
  const abs = issueKuchikomiPath(dateStr);
  if (await fileExists(abs)) {
    return { path: abs, created: false };
  }
  const body = `# optional URL index for pubDate ${dateStr}
# Primary input: drop human-exported HTML at
#   data/kuchikomi/${dateStr}.threads.html
#   or data/kuchikomi/${dateStr}/*.html  (browser Save Page + optional _files/)
# This .txt is optional (one URL per line). Do not commit. Agent does not fetch threads.com.
# Agent waits in chat until HTML is dropped or operator says skip.

`;
  await writeFile(abs, body, 'utf8');
  return { path: abs, created: true };
}

function parseArgs(argv) {
  const opts = {
    vol: null,
    date: null,
    kuchikomi: null,
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

async function listKuchikomiFiles(singlePath) {
  if (singlePath) {
    const ok = await fileExists(singlePath);
    return ok
      ? [{ path: singlePath, rel: path.relative(ROOT, singlePath) }]
      : [];
  }
  try {
    const names = await readdir(KUCHIKOMI_DIR);
    const out = [];
    for (const name of names.sort()) {
      if (name.startsWith('.') || name === 'example.txt') continue;
      const abs = path.join(KUCHIKOMI_DIR, name);
      const st = await stat(abs);
      if (st.isFile()) {
        if (name.endsWith('.txt') || name.endsWith('.html') || name.endsWith('.threads.html')) {
          out.push({ path: abs, rel: path.relative(ROOT, abs) });
        }
        continue;
      }
      if (!st.isDirectory()) continue;
      let children = [];
      try {
        children = await readdir(abs);
      } catch {
        continue;
      }
      for (const child of children.sort()) {
        if (!child.endsWith('.html') || child.startsWith('.')) continue;
        const childAbs = path.join(abs, child);
        const cst = await stat(childAbs);
        if (cst.isFile()) {
          out.push({ path: childAbs, rel: path.relative(ROOT, childAbs) });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/draft-issue.mjs --vol N --date YYYY-MM-DD [--kuchikomi path] [--print-prompt]
  Step C checklist. Full instructions: ${PROMPT_REL}
  口コミ ops: docs/kuchikomi.md`);
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
  const shell = opts.kuchikomi
    ? { path: opts.kuchikomi, created: false }
    : await ensureIssueKuchikomiShell(opts.date);
  const kuchikomiFiles = await listKuchikomiFiles(opts.kuchikomi || shell.path);
  const shellRel = path.relative(ROOT, shell.path);

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
  console.log(`口コミ ops   : docs/kuchikomi.md`);
  console.log(`Manifest     : data/kouhou/manifest.json`);
  console.log(`Extracted    : ${extracted.length} dir(s) under data/kouhou/extracted/`);
  const kuchikomiExtractDir = path.join(KUCHIKOMI_DIR, 'extracted', opts.date);
  const kuchikomiPostsJson = path.join(kuchikomiExtractDir, 'posts.json');
  const kuchikomiPostsMd = path.join(kuchikomiExtractDir, 'posts.md');
  const hasKuchikomiExtract = await fileExists(kuchikomiPostsJson);
  let kuchikomiPostCount = 0;
  if (hasKuchikomiExtract) {
    try {
      const doc = JSON.parse(await readFile(kuchikomiPostsJson, 'utf8'));
      kuchikomiPostCount = Array.isArray(doc.posts) ? doc.posts.length : 0;
    } catch {
      /* ignore */
    }
  }

  console.log(`口コミ index : ${shellRel}${shell.created ? ' (created optional URL index)' : ' (exists)'}`);
  console.log(`口コミ HTML  : drop at data/kuchikomi/${opts.date}.threads.html or data/kuchikomi/${opts.date}/`);
  console.log(
    `口コミ extract: ${hasKuchikomiExtract ? path.relative(ROOT, kuchikomiPostsJson) + ` (${kuchikomiPostCount} posts)` : '(missing — run npm run extract:kuchikomi -- --date ' + opts.date + ')'}`,
  );
  console.log(`口コミ dump  : ${kuchikomiFiles.length} html/txt under data/kuchikomi/`);

  if (!extracted.length) {
    console.log(`\n⚠ No extracts found. Run Steps A then B:\n  npm run fetch:kouhou\n  npm run extract:kouhou\n`);
  } else {
    console.log('\nPrimary inputs (prefer these over raw PDFs):');
    for (const e of extracted) {
      const short = e.sha256 ? e.sha256.slice(0, 12) : '—';
      console.log(`  - ${e.dir}/text.txt  (${e.name}, sha ${short}…, images=${e.images})`);
    }
  }

  if (hasKuchikomiExtract) {
    console.log('\n口コミ extracted (street voice — draft from these, not raw HTML):');
    console.log(`  - ${path.relative(ROOT, kuchikomiPostsJson)}`);
    if (await fileExists(kuchikomiPostsMd)) console.log(`  - ${path.relative(ROOT, kuchikomiPostsMd)}`);
  } else if (kuchikomiFiles.length) {
    console.log('\n口コミ dump present but not extracted yet:');
    for (const f of kuchikomiFiles) console.log(`  - ${f.rel}`);
  }

  const generatedDirRel = `public/images/generated/vol-${opts.vol}`;
  const generatedDirAbs = path.join(ROOT, generatedDirRel);
  let generatedCount = 0;
  if (await fileExists(generatedDirAbs)) {
    try {
      const names = await readdir(generatedDirAbs);
      generatedCount = names.filter((n) => !n.startsWith('.') && /\.(png|jpe?g|webp)$/i.test(n)).length;
    } catch {
      /* ignore */
    }
  }
  console.log(`AI images   : ${generatedDirRel}/ (${generatedCount} file(s); topic-text only — docs/ai-generated-images.md)`);

  console.log(`
Next (operator / any agent — Cursor by current policy):
  1. Read ${PROMPT_REL}, POLICY.md, docs/ai-generated-images.md, docs/kuchikomi.md, docs/threads-citation-rules.md
  2. If口コミ dump exists: npm run extract:kuchikomi -- --date ${opts.date}
  3. WAIT if posts.json missing (or operator says skip). Do not fetch threads.com post pages
  4. Draft from kouhou extracted text + kuchikomi posts.json (do NOT copy/embed data/kouhou/extracted/.../images into the article or public/images/kouhou; do NOT use them as AI image inputs)
  5. For pickups: generate AI images from topic text only → ${generatedDirRel}/ ; disclose in article when needed; write ${outRel} with draft: true
  6. npm run prose-review -- --vol ${opts.vol}  (scripts/prose-review-prompt.md — media voice / meta / region h3 / 1-sentence口コミ / AI disclosure)
  7. Human review → clear draft flag only to publish → npm run check → git commit / push (never auto-publish)
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
