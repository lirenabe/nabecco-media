#!/usr/bin/env node
/**
 * Reference-layer generator: Step B extracts → tracked Markdown under src/content/kouhou/.
 * Mechanical outline only (no vendor LLM). Run locally after extract:kouhou; commit outputs.
 *
 *   npm run generate:kouhou-pages
 *   npm run generate:kouhou-pages -- --only city-katagami
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSources } from './lib/sources.mjs';
import { redactMobileNumbers } from './lib/privacy-redact.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const EXTRACT_ROOT = path.join(ROOT, 'data/kouhou/extracted');
const OUT_DIR = path.join(ROOT, 'src/content/kouhou');

const SKIP_SECTION_RE =
  /叙勲|褒章|おくやみ|お悔やみ|戸籍の窓|戸籍|出生届|結婚届|離婚届|死亡届|ご逝去|ご冥福/u;

const TOC_LINE_RE = /^(.+?)[.…･・\s]{2,}(\d{1,3})\s*$/u;

function parseArgs(argv) {
  const only = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--only' && argv[i + 1]) {
      for (const id of argv[++i].split(',')) {
        const t = id.trim();
        if (t) only.add(t);
      }
    }
  }
  return { only };
}

function splitPages(text) {
  const parts = text.split(/^---\s*page\s+(\d+)\s*---\s*$/imu);
  /** @type {{ page: number, text: string }[]} */
  const pages = [];
  for (let i = 1; i < parts.length; i += 2) {
    pages.push({ page: Number(parts[i]), text: (parts[i + 1] || '').trim() });
  }
  if (!pages.length && text.trim()) {
    pages.push({ page: 1, text: text.trim() });
  }
  return pages;
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
  return m[1].replace(/[０-９]/g, (c) => String('０１２３４５６７８９'.indexOf(c)));
}

function extractToc(pages) {
  /** @type {{ title: string, page: number }[]} */
  const items = [];
  const early = pages.filter((p) => p.page <= 3).map((p) => p.text).join('\n');
  for (const line of early.split(/\n/)) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (t.length < 4 || t.length > 80) continue;
    const m = t.match(TOC_LINE_RE);
    if (!m) continue;
    const title = m[1].replace(/\s+/g, ' ').trim();
    const page = Number(m[2]);
    if (!title || !page || SKIP_SECTION_RE.test(title)) continue;
    if (items.some((x) => x.title === title && x.page === page)) continue;
    items.push({ title, page });
  }
  return items.slice(0, 40);
}

function pageExcerpt(pageText, maxLen = 180) {
  const cleaned = pageText
    .replace(/\u3000/g, ' ')
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8 && !/^---/.test(l))
    .join('');
  const one = cleaned.replace(/\s+/g, ' ').trim();
  if (one.length <= maxLen) return one;
  return `${one.slice(0, maxLen)}…`;
}

function shouldSkipPage(text) {
  const head = text.slice(0, 400);
  return SKIP_SECTION_RE.test(head);
}

/**
 * Lightweight event candidates for the calendar (best-effort).
 * @param {string} fullText
 * @param {string} yearMonth
 */
function extractEvents(fullText, yearMonth) {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const monthHint = Number(mStr);
  /** @type {{ when: string, what: string, where: string, contact: string }[]} */
  const out = [];
  const lines = fullText.split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const dateRe =
    /((?:令和\s*[０-９0-9]+年)?\s*[０-９0-9]{1,2}\s*月\s*[０-９0-9]{1,2}\s*日|(?:[０-９0-9]{4}\s*年)?\s*[０-９0-9]{1,2}\s*月\s*[０-９0-9]{1,2}\s*日)/u;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length < 8 || line.length > 120) continue;
    if (SKIP_SECTION_RE.test(line)) continue;
    const m = line.match(dateRe);
    if (!m) continue;
    const when = m[1].replace(/\s+/g, '');
    // Prefer lines that look like announcements, not body prose mid-sentence.
    if (!/[開催|受付|募集|申込|オープン|まつり|祭|講座|教室|相談]/u.test(line) && i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!/[開催|受付|募集|申込]/u.test(next) && next.length > 40) continue;
    }
    const what = line.slice(0, 90);
    out.push({ when, what, where: '', contact: '' });
    if (out.length >= 30) break;
  }

  // Dedupe by when+what
  const seen = new Set();
  return out.filter((e) => {
    const k = `${e.when}|${e.what}`;
    if (seen.has(k)) return false;
    seen.add(k);
    // Rough filter: keep dates in issue month ±1 when parseable as M月D日
    const md = e.when.match(/([0-9０-９]{1,2})月([0-9０-９]{1,2})日/);
    if (md && monthHint) {
      const mo = Number(String(md[1]).replace(/[０-９]/g, (c) => '０１２３４５６７８９'.indexOf(c)));
      if (Math.abs(mo - monthHint) > 2 && mo !== 1 && monthHint !== 12) return false;
    }
    void year;
    return true;
  });
}

function yamlEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildMarkdown({
  source,
  meta,
  yearMonth,
  issueNo,
  toc,
  sections,
  events,
  listingUrl,
  sourceUrl,
}) {
  const title = issueNo
    ? `${source.name} 広報 ${yearMonth.replace('-', '年')}月号（No.${issueNo}）`
    : `${source.name} 広報 ${yearMonth.replace('-', '年')}月号`;
  const description = `${source.name}の公式広報 ${yearMonth.replace('-', '年')}月号の要約です。`;

  const eventYaml =
    events.length === 0
      ? 'events: []\n'
      : `events:\n${events
          .map(
            (e) =>
              `  - when: "${yamlEscape(e.when)}"\n    what: "${yamlEscape(e.what)}"\n    where: "${yamlEscape(e.where)}"\n    contact: "${yamlEscape(e.contact)}"`,
          )
          .join('\n')}\n`;

  const tocBlock =
    toc.length === 0
      ? '（目次を機械抽出できませんでした。原本の目次をご確認ください。）\n'
      : toc.map((t) => `- ${t.title}（p.${t.page}）`).join('\n') + '\n';

  const sectionBlock =
    sections.length === 0
      ? '（ページ要約を機械抽出できませんでした。）\n'
      : sections
          .map((s) => `### ${s.title}\n\n${s.excerpt}\n`)
          .join('\n');

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
${eventYaml}---

<aside class="info-note" role="note">
  <p>このページは公式広報 PDF の<strong>機械的な要約</strong>です。日程・期限・料金など確定情報は、必ず原本（公式 PDF／自治体サイト）で確認してください。</p>
</aside>

## この号の案内

${tocBlock}
## 内容の要約

${sectionBlock}
## 出典

- 公式の広報案内: [${source.name} 広報](${listingUrl})
- PDF: [原本を開く](${sourceUrl})
`;
}

async function loadMeta(extractDir) {
  try {
    return JSON.parse(await readFile(path.join(extractDir, 'meta.json'), 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  const { only } = parseArgs(process.argv.slice(2));
  const { sources } = await loadSources();
  await mkdir(OUT_DIR, { recursive: true });

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
    text = redactMobileNumbers(text, '');
    const pages = splitPages(text).filter((p) => !shouldSkipPage(p.text));
    const yearMonth = detectYearMonth(text, meta.extractedAt || meta.fetchedAt);
    const issueNo = detectIssueNo(text);
    const toc = extractToc(splitPages(text));
    const byPage = new Map(pages.map((p) => [p.page, p.text]));

    /** @type {{ title: string, excerpt: string }[]} */
    const sections = [];
    if (toc.length) {
      for (const item of toc.slice(0, 25)) {
        const pageText = byPage.get(item.page) || '';
        const excerpt = pageExcerpt(pageText || item.title);
        if (!excerpt) continue;
        sections.push({ title: item.title, excerpt });
      }
    } else {
      for (const p of pages.slice(0, 12)) {
        const excerpt = pageExcerpt(p.text);
        if (!excerpt) continue;
        sections.push({ title: `${source.name} 広報 p.${p.page}`, excerpt });
      }
    }

    const events = extractEvents(text, yearMonth);
    const listingUrl = source.listingUrl || meta.url || '';
    const sourceUrl = meta.url || listingUrl;
    const body = buildMarkdown({
      source,
      meta,
      yearMonth,
      issueNo,
      toc,
      sections,
      events,
      listingUrl,
      sourceUrl,
    });

    const fileName = `${source.id}__${yearMonth}.md`;
    const outPath = path.join(OUT_DIR, fileName);
    await writeFile(outPath, body, 'utf8');
    written += 1;
    console.log(`wrote ${path.relative(ROOT, outPath)} (events≈${events.length})`);
  }

  // Touch .gitkeep if empty
  const files = await readdir(OUT_DIR).catch(() => []);
  if (!files.length) {
    await writeFile(path.join(OUT_DIR, '.gitkeep'), '', 'utf8');
  }

  console.log(`\ndone: wrote ${written}, skipped ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
