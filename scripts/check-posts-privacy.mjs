#!/usr/bin/env node
/**
 * Fail if weekly posts contain Japanese mobile numbers (070/080/090).
 * Private-person names are a draft-prompt / human rule (not auto-detectable).
 *
 * Usage:
 *   npm run check:posts-privacy
 *   node scripts/check-posts-privacy.mjs [path...]
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { findMobileNumbers } from './lib/privacy-redact.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');

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

for (const file of files) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    console.error(`check:posts-privacy: cannot read ${file}`);
    process.exitCode = 1;
    continue;
  }
  const mobiles = findMobileNumbers(text);
  if (!mobiles.length) continue;
  const rel = path.relative(ROOT, file);
  const lines = text.split(/\r?\n/);
  for (const { match, index } of mobiles) {
    const before = text.slice(0, index);
    const line = before.split(/\r?\n/).length;
    const snippet = (lines[line - 1] || '').trim().slice(0, 160);
    hits.push({ file: rel, line, match, snippet });
  }
}

if (hits.length === 0 && !process.exitCode) {
  console.log('check:posts-privacy: ok（記事内に携帯電話番号なし）');
  process.exit(0);
}

if (hits.length) {
  console.error(`check:posts-privacy: ${hits.length} 件の携帯電話番号`);
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.match}`);
    console.error(`    ${h.snippet}`);
  }
  console.error(
    '私人の携帯電話は記事に載せない。問い合わせは部署・団体の固定電話のみ（scripts/draft-prompt.md）。',
  );
  process.exit(1);
}
