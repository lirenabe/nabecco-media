#!/usr/bin/env node
/**
 * Design guideline heuristic (requirements §10(3)):
 * Flag card-like chrome: border-radius together with a box border / box-shadow
 * in the same CSS rule block. Allows hairlines (border-top/bottom/left/right only)
 * and border-radius: 0 / 50% (circles).
 *
 * Not a visual proof — pragmatic static scan of src CSS and Astro <style> blocks.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(css|astro)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function extractStyleBlocks(source, file) {
  if (file.endsWith('.css')) return [{ css: source, label: file }];
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  let i = 0;
  while ((m = re.exec(source))) {
    i += 1;
    blocks.push({ css: m[1], label: `${file} <style>#${i}` });
  }
  return blocks;
}

function splitRules(css) {
  // Drop comments
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return cleaned.split('}').map((chunk) => chunk.trim()).filter(Boolean);
}

function isCardLike(ruleBody) {
  const hasRadius =
    /border-radius\s*:\s*(?!0(?:px|rem|em|%)?\s*;|50%\s*;)/i.test(ruleBody) &&
    /border-radius\s*:\s*[^;]+;/i.test(ruleBody);
  if (!hasRadius) return false;

  const hasBoxBorder = /(?:^|[^-])border\s*:\s*(?!none|0\b)[^;]+;/im.test(ruleBody);
  const hasShadow =
    /box-shadow\s*:\s*(?!none)[^;]+;/i.test(ruleBody) &&
    !/box-shadow\s*:\s*none/i.test(ruleBody);

  return hasBoxBorder || hasShadow;
}

const files = await walk(SRC);
const hits = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const { css, label } of extractStyleBlocks(source, path.relative(ROOT, file))) {
    for (const rule of splitRules(css)) {
      const body = rule.includes('{') ? rule.slice(rule.indexOf('{') + 1) : rule;
      if (isCardLike(body)) {
        const sel = rule.slice(0, rule.indexOf('{')).trim().replace(/\s+/g, ' ');
        hits.push(`${label}: ${sel || '(rule)'}`);
      }
    }
  }
}

if (hits.length) {
  console.error('Design check failed — card-like border-radius + box chrome:\n');
  for (const h of hits) console.error(`  - ${h}`);
  console.error('\nUse whitespace or simple straight hairlines instead.');
  process.exit(1);
}

console.log('Design check passed (no card-like radius+border/shadow rules).');
