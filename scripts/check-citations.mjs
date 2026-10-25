#!/usr/bin/env node
/**
 * Structural "fact-check" stand-in: issue Markdown sections with real prose
 * should include at least one http(s) citation or a 出典 line.
 *
 * Placeholder stubs like （…ここに書く） are waived.
 * This does NOT verify factual accuracy.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const POSTS = path.resolve(import.meta.dirname, '../src/content/posts');
const STUB = /^[（(].*(ここに書く|TODO|TBD|下書き).*[）)]$/u;
const CITE = /https?:\/\/\S+|^\s*>\s*出典/m;
/** Abbreviated citations are not allowed — every item needs a full source. */
const BAD_ABBREV = /^\s*>\s*出典\s*[:：]\s*(同上|同|前掲)(?:\s|[（(]|$)/u;

function stripFrontmatter(md) {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  return end === -1 ? md : md.slice(end + 4);
}

/** Split on ATX h1–h3 so pickup (# / ##) and item (###) blocks are checked. */
function sections(body) {
  const parts = body.split(/^(#{1,3})\s+/m).slice(1);
  const out = [];
  for (let i = 0; i < parts.length; i += 2) {
    const marks = parts[i];
    const rest = parts[i + 1] ?? '';
    const nl = rest.indexOf('\n');
    const title = (nl === -1 ? rest : rest.slice(0, nl)).trim();
    const content = (nl === -1 ? '' : rest.slice(nl + 1)).trim();
    out.push({ level: marks.length, title, content });
  }
  return out;
}

function isSubstantial(content) {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !STUB.test(l))
    // Nested headings belong to their own section slice
    .filter((l) => !/^#{1,3}\s+/.test(l));
  const text = lines.join('');
  return text.length >= 40;
}

const files = (await readdir(POSTS)).filter((f) => f.endsWith('.md'));
const failures = [];

for (const file of files) {
  const raw = await readFile(path.join(POSTS, file), 'utf8');
  const body = stripFrontmatter(raw);
  for (const line of body.split('\n')) {
    if (BAD_ABBREV.test(line)) {
      failures.push(`${file}: abbreviated citation not allowed (${line.trim()})`);
    }
  }
  for (const { level, title, content } of sections(body)) {
    // Section shells hold ### items; cites live on pickups (# / ##) and items (###).
    if (level === 2 && /^(直近のイベント情報|今週のあきた)$/u.test(title)) continue;
    if (!isSubstantial(content)) continue;
    if (!CITE.test(content)) {
      failures.push(`${file} ${'#'.repeat(level)} ${title}: needs http(s) link or 「> 出典」 line`);
    }
  }
}

if (failures.length) {
  console.error('Citation check failed:\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('Citation check passed (stubs waived; substantial sections need sources).');
