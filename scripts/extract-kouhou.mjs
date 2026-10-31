#!/usr/bin/env node
/**
 * Step B — 内容抽出: from cached PDFs → text (+ embedded images) under
 * data/kouhou/extracted/<id>/, keyed by PDF sha256 (skip if unchanged).
 *
 * Requires Python 3 + pymupdf (preferred) or pypdf. See scripts/requirements-kouhou.txt.
 *
 * Usage:
 *   npm run extract:kouhou
 *   npm run extract:kouhou -- --only pref-akita,city-yokote
 *   npm run extract:kouhou -- --force
 */
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  extractDirRel,
  getEntry,
  loadManifest,
  saveManifest,
  setEntry,
  sha256Buffer,
} from './lib/manifest.mjs';
import { loadSources } from './lib/sources.mjs';
import { sleep } from './lib/http.mjs';

const PY_HELPER = path.join(import.meta.dirname, 'lib/extract-pdf.py');
const POLITE_DELAY_MS = 100;

function parseArgs(argv) {
  const opts = { only: null, force: false, maxPages: 0, maxImages: 40, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') opts.only = new Set(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--force') opts.force = true;
    else if (a === '--max-pages') opts.maxPages = Number(argv[++i]);
    else if (a === '--max-images') opts.maxImages = Number(argv[++i]);
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function runPython(pdfAbs, outAbs, { maxPages, maxImages }) {
  return new Promise((resolve, reject) => {
    const args = [PY_HELPER, pdfAbs, outAbs, '--max-images', String(maxImages)];
    if (maxPages > 0) args.push('--max-pages', String(maxPages));
    const child = spawn('python3', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout.trim().split('\n').at(-1) || '{}'));
        } catch {
          resolve({ ok: true, raw: stdout });
        }
      } else {
        reject(new Error(stderr.trim() || `extract-pdf.py exit ${code}`));
      }
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/extract-kouhou.mjs [--only id1,id2] [--force] [--max-pages N] [--max-images N]
  Step B: extract text + embedded images from data/kouhou PDFs.`);
    process.exit(0);
  }

  const { sources, root } = await loadSources();
  const { doc: manifest } = await loadManifest(root);
  await mkdir(path.join(root, 'data/kouhou/extracted'), { recursive: true });
  await mkdir(path.join(root, 'data/reports'), { recursive: true });

  const work = [];
  for (const s of sources) {
    if (opts.only && !opts.only.has(s.id)) continue;
    const entry = getEntry(manifest, s.id);
    const rel = entry?.path || path.join('data/kouhou', `${s.code}_${s.id}.pdf`);
    const abs = path.join(root, rel);
    if (!(await exists(abs))) continue;
    work.push({ source: s, entry, rel, abs });
  }

  console.log(`extract-kouhou (Step B): ${work.length} PDF(s)\n`);
  const results = [];

  for (let i = 0; i < work.length; i++) {
    if (i > 0) await sleep(POLITE_DELAY_MS);
    const { source, entry, rel, abs } = work[i];
    const row = { id: source.id, ok: false };
    try {
      const buf = await readFile(abs);
      const sha256 = entry?.sha256 && entry.path === rel ? entry.sha256 : sha256Buffer(buf);
      const outRel = extractDirRel(source.id);
      const outAbs = path.join(root, outRel);
      const metaPath = path.join(outAbs, 'meta.json');
      const textPath = path.join(outAbs, 'text.txt');

      if (!opts.force && (await exists(metaPath)) && (await exists(textPath))) {
        const prevMeta = JSON.parse(await readFile(metaPath, 'utf8'));
        if (prevMeta.sha256 === sha256) {
          row.ok = true;
          row.cached = true;
          row.path = outRel;
          row.sha256 = sha256;
          console.log(`CACHE ${source.id}  extract unchanged  ${outRel}`);
          results.push(row);
          continue;
        }
      }

      await mkdir(outAbs, { recursive: true });
      const py = await runPython(abs, outAbs, {
        maxPages: opts.maxPages,
        maxImages: opts.maxImages,
      });

      const meta = {
        id: source.id,
        name: source.name,
        sha256,
        pdfPath: rel,
        url: entry?.url || '',
        extractedAt: new Date().toISOString(),
        pagesTotal: py.pagesTotal,
        pagesExtracted: py.pagesExtracted,
        textFile: 'text.txt',
        contentFile: 'content.md',
        images: py.images || [],
        imageCount: py.imageCount || 0,
        tool: py.tool || 'pymupdf',
        ocr: Boolean(py.ocr),
        ocrNote: py.ocrNote || '',
      };
      await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

      if (entry) {
        setEntry(manifest, source.id, {
          ...entry,
          sha256,
          extractPath: outRel,
          extractedAt: meta.extractedAt,
        });
      }

      row.ok = true;
      row.path = outRel;
      row.sha256 = sha256;
      row.pages = meta.pagesExtracted;
      row.images = meta.imageCount;
      console.log(
        `OK    ${source.id}  ${outRel}  pages=${meta.pagesExtracted}/${meta.pagesTotal} images=${meta.imageCount}`,
      );
    } catch (err) {
      row.ok = false;
      row.error = err.message || String(err);
      console.error(`FAIL  ${source.id}  ${row.error}`);
    }
    results.push(row);
  }

  await saveManifest(root, manifest);

  const reportPath = path.join(
    root,
    'data/reports',
    `extract-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const ok = results.filter((r) => r.ok && !r.cached).length;
  const cached = results.filter((r) => r.cached).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nDone. extracted=${ok} cached=${cached} fail=${fail}`);
  console.log(`Report: ${path.relative(root, reportPath)}`);
  if (fail > 0 && ok === 0 && cached === 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
