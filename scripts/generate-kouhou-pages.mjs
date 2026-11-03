#!/usr/bin/env node
/**
 * Reference-layer scaffold — no vendor LLM API.
 * Writes / refreshes frontmatter + 出典シェル under src/content/kouhou/.
 * Body summaries are written by an agent following scripts/kouhou-summary-prompt.md
 * (same operator model as Step C / draft-prompt.md).
 *
 *   npm run generate:kouhou-pages
 *   npm run generate:kouhou-pages -- --only city-katagami
 *   npm run generate:kouhou-pages -- --force-body   # overwrite body with empty shell
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { loadSources } from './lib/sources.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXTRACT_ROOT = path.join(ROOT, 'data/kouhou/extracted');
const OUT_DIR = path.join(ROOT, 'src/content/kouhou');
const PROMPT_REL = 'scripts/kouhou-summary-prompt.md';

function parseArgs(argv) {
  const only = new Set();
  let forceBody = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--only' && argv[i + 1]) {
      for (const id of argv[++i].split(',')) {
        const t = id.trim();
        if (t) only.add(t);
      }
    } else if (argv[i] === '--force-body') {
      forceBody = true;
    }
  }
  return { only, forceBody };
}

function zenkakuDigitsToAscii(s) {
  return String(s).replace(/[０-９]/g, (c) => String('０１２３４５６７８９'.indexOf(c)));
}

function detectYearMonth(fullText, fetchedAt) {
  const head = fullText.slice(0, 2500);
  const patterns = [
    /(\d{4})\s*年\s*(\d{1,2})\s*月号/,
    /(\d{4})\s*年[）)]\s*(\d{1,2})\s*月号/s,
    /(\d{4})\s*年[\s\S]{0,40}?(\d{1,2})\s*月号/,
    /(\d{4})\.(\d{1,2})/,
    /No\.\s*[0-9０-９]+【\s*(\d{4})\s*年[^】]{0,20}?([0-9０-９]{1,2})\s*月号/,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (!m) continue;
    const y = Number(zenkakuDigitsToAscii(m[1]));
    const mo = Number(zenkakuDigitsToAscii(m[2]));
    if (y >= 2000 && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, '0')}`;
    }
  }
  if (fetchedAt) {
    const d = new Date(fetchedAt);
    if (!Number.isNaN(d.valueOf())) {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
  }
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function detectIssueNo(fullText) {
  const m = fullText.match(/No\.?\s*([0-9０-９]{1,4})/u);
  if (!m) return '';
  return zenkakuDigitsToAscii(m[1]);
}

function yamlEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function yearMonthLabel(yearMonth) {
  const [y, m] = yearMonth.split('-');
  return `${y}年${Number(m)}月号`;
}

function readDiscoveredAt(raw) {
  const m = /^discoveredAt:\s*"([^"]+)"/m.exec(raw);
  return m?.[1]?.trim() || '';
}

function buildShell({
  source,
  meta,
  yearMonth,
  issueNo,
  listingUrl,
  sourceUrl,
  eventsYaml,
  discoveredAt,
}) {
  const label = yearMonthLabel(yearMonth);
  const title = issueNo
    ? `${source.name} 広報 ${label}（No.${issueNo}）`
    : `${source.name} 広報 ${label}`;
  // Scaffold fallback only. After 案内 is written, meta description is derived at
  // build time from those bullets (see kouhouIssueMetaDescription); agents should
  // also refresh frontmatter description per kouhou-summary-prompt.md.
  const description = `${source.name}の広報${label}の要約。`;
  const discoveredLine = discoveredAt ? `discoveredAt: "${yamlEscape(discoveredAt)}"\n` : '';

  return `---
title: "${yamlEscape(title)}"
description: "${yamlEscape(description)}"
muniId: ${source.id}
muniName: "${yamlEscape(source.name)}"
yearMonth: "${yearMonth}"
issueNo: "${yamlEscape(issueNo)}"
listingUrl: "${yamlEscape(listingUrl)}"
sourceUrl: "${yamlEscape(sourceUrl)}"
sha256: "${yamlEscape(meta.sha256 || '')}"
generatedAt: "${new Date().toISOString()}"
${discoveredLine}${eventsYaml}---

<aside class="info-note" role="note">
  <p>このページは公式広報 PDF の要約です。日程・期限・料金など確定情報は、必ず原本（公式 PDF／自治体サイト）で確認してください。</p>
</aside>

## 出典

- 公式の広報案内: [${source.name} 広報](${listingUrl})
- PDF: [原本を開く](${sourceUrl})
`;
}

function splitFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return null;
  const end = raw.indexOf('\n---\n', 4);
  if (end < 0) return null;
  return {
    fm: raw.slice(0, end + 5),
    body: raw.slice(end + 5),
  };
}

async function loadMeta(extractDir) {
  try {
    return JSON.parse(await readFile(path.join(extractDir, 'meta.json'), 'utf8'));
  } catch {
    return {};
  }
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { only, forceBody } = parseArgs(process.argv.slice(2));
  const { sources } = await loadSources();
  await mkdir(OUT_DIR, { recursive: true });

  const needSummary = [];
  let written = 0;
  let skipped = 0;

  for (const source of sources) {
    if (only.size && !only.has(source.id)) continue;
    const extractDir = path.join(EXTRACT_ROOT, source.id);
    let text = '';
    try {
      text = await readFile(path.join(extractDir, 'text.txt'), 'utf8');
    } catch {
      skipped += 1;
      console.log(`skip ${source.id}: no extract`);
      continue;
    }

    const meta = await loadMeta(extractDir);
    const yearMonth = detectYearMonth(text, meta.extractedAt);
    const issueNo = detectIssueNo(text);
    const listingUrl = source.listingUrl || meta.url || '';
    const sourceUrl = meta.url || listingUrl;
    const fileName = `${source.id}__${yearMonth}.md`;
    const outPath = path.join(OUT_DIR, fileName);
    const rel = path.relative(ROOT, outPath);

    const exists = await fileExists(outPath);
    let existingRaw = '';
    if (exists) {
      existingRaw = await readFile(outPath, 'utf8');
      if (!forceBody) {
        const hasSummary =
          /^## 内容の要約\s*$/m.test(existingRaw) || /^## この号の案内\s*$/m.test(existingRaw);
        if (hasSummary) {
          console.log(`keep ${rel} (summary present; use --force-body to reset)`);
          written += 1;
          continue;
        }
      }
    }

    // Brand-new yearMonth file only — marks “新着の広報” for the next weekly issue.
    // Existing pages keep prior discoveredAt; never invent one on force-body rebuilds.
    const priorDiscovered = exists ? readDiscoveredAt(existingRaw) : '';
    const discoveredAt = exists ? priorDiscovered : new Date().toISOString();

    const shell = buildShell({
      source,
      meta,
      yearMonth,
      issueNo,
      listingUrl,
      sourceUrl,
      eventsYaml: 'events: []\n',
      discoveredAt,
    });
    await writeFile(outPath, shell, 'utf8');
    needSummary.push(rel);
    written += 1;
    console.log(`scaffold ${rel}${discoveredAt && !priorDiscovered ? ' (new edition)' : ''}`);
  }

  console.log(`\ndone: touched ${written}, skipped ${skipped}`);
  console.log(`prompt: ${PROMPT_REL}`);
  if (needSummary.length) {
    console.log('needs LLM summary (agent):');
    for (const p of needSummary) console.log(`  - ${p}`);
  } else {
    console.log('no empty scaffolds; nothing queued for summary');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
