#!/usr/bin/env node
/**
 * Fail if weekly posts contain truncated / malformed Threads oEmbed stubs.
 * Catches the class of bug where an embed is cut at an inner </div>
 * (unclosed <blockquote> / outer .threads-embed).
 *
 * Usage:
 *   npm run check:threads-embeds
 *   node scripts/check-threads-embeds.mjs [path...]
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');

const OPEN_RE = /<div\s+class="threads-embed"\s*>/gi;
/** Well-formed stub: outer div → blockquote → … → </blockquote></div> */
const COMPLETE_RE =
  /^<div\s+class="threads-embed"\s*>\s*<blockquote\b[^>]*\bclass="[^"]*\btext-post-media\b[^"]*"[^>]*>[\s\S]*?<\/blockquote>\s*<\/div>/i;

function lineAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function countTag(html, openName) {
  const open = html.match(new RegExp(`<${openName}\\b`, 'gi'))?.length ?? 0;
  const close = html.match(new RegExp(`</${openName}\\s*>`, 'gi'))?.length ?? 0;
  return { open, close };
}

/**
 * @param {string} text
 * @param {string} rel
 * @returns {{ file: string, line: number, reason: string }[]}
 */
function findBrokenThreadsEmbeds(text, rel = '') {
  const hits = [];
  let m;
  OPEN_RE.lastIndex = 0;
  while ((m = OPEN_RE.exec(text)) !== null) {
    const start = m.index;
    const line = lineAt(text, start);
    const from = text.slice(start);
    const complete = from.match(COMPLETE_RE);
    if (!complete) {
      hits.push({
        file: rel,
        line,
        reason:
          '埋め込みが途中で切れている（</blockquote></div> まで閉じられていない）。内側の </div> で切らないこと',
      });
      continue;
    }
    const html = complete[0];
    const divs = countTag(html, 'div');
    const bqs = countTag(html, 'blockquote');
    if (divs.open !== divs.close) {
      hits.push({
        file: rel,
        line,
        reason: `div の開閉不一致（open=${divs.open} close=${divs.close}）`,
      });
    }
    if (bqs.open !== bqs.close || bqs.open < 1) {
      hits.push({
        file: rel,
        line,
        reason: `blockquote の開閉不一致（open=${bqs.open} close=${bqs.close}）`,
      });
    }
    const permalink = html.match(
      /data-text-post-permalink="https:\/\/www\.threads\.com\/t\/([^?"#]+)/i,
    );
    const igTp = html.match(/\bid="ig-tp-([^"]+)"/i);
    if (!permalink) {
      hits.push({
        file: rel,
        line,
        reason: 'data-text-post-permalink（threads.com/t/…）が無い',
      });
    } else if (igTp && permalink[1] !== igTp[1]) {
      hits.push({
        file: rel,
        line,
        reason: `permalink id (${permalink[1]}) と ig-tp id (${igTp[1]}) が不一致`,
      });
    }
    OPEN_RE.lastIndex = start + html.length;
  }
  return hits;
}

async function listDefaultPosts() {
  const names = await readdir(POSTS_DIR);
  return names
    .filter((n) => n.endsWith('.md'))
    .map((n) => path.join(POSTS_DIR, n));
}

const targets = process.argv.slice(2);
const files =
  targets.length > 0
    ? targets.map((t) => path.resolve(t))
    : await listDefaultPosts();

const hits = [];
let readFail = false;

for (const file of files) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    console.error(`check:threads-embeds: cannot read ${file}`);
    readFail = true;
    continue;
  }
  const rel = path.relative(ROOT, file);
  hits.push(...findBrokenThreadsEmbeds(text, rel));
}

if (hits.length === 0 && !readFail) {
  console.log('check:threads-embeds: ok（Threads 埋め込みの開閉・permalink 整合）');
  process.exit(0);
}

if (hits.length) {
  console.error(`check:threads-embeds: ${hits.length} 件の不正な埋め込み`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.reason}`);
  }
  console.error(
    '公式 oEmbed スタブは <div class="threads-embed">…</blockquote></div> まで含める（docs/kuchikomi.md）。',
  );
  process.exit(1);
}
process.exit(1);
