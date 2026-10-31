#!/usr/bin/env node
/**
 * Design guideline heuristic (requirements §10(3)):
 * Avoid chrome that reads as generic template output. Rounded corners and
 * thin borders are fine; decorative box-shadows are not.
 *
 * Flags any CSS rule that sets a non-none `box-shadow`.
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

function hasDecorativeShadow(ruleBody) {
  return /box-shadow\s*:\s*(?!none\s*;)[^;]+;/i.test(ruleBody);
}

const files = await walk(SRC);
const hits = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const { css, label } of extractStyleBlocks(source, path.relative(ROOT, file))) {
    for (const rule of splitRules(css)) {
      const body = rule.includes('{') ? rule.slice(rule.indexOf('{') + 1) : rule;
      if (hasDecorativeShadow(body)) {
        const sel = rule.slice(0, rule.indexOf('{')).trim().replace(/\s+/g, ' ');
        hits.push(`${label}: ${sel || '(rule)'}`);
      }
    }
  }
}

if (hits.length) {
  console.error('Design check failed — decorative box-shadow:\n');
  for (const h of hits) console.error(`  - ${h}`);
  console.error('\nUse borders, spacing, or background tint instead of shadows.');
  process.exit(1);
}

console.log('Design check passed (no decorative box-shadow rules).');
