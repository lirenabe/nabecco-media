#!/usr/bin/env node
/**
 * Shared Markdown globs for prose + link checks:
 * - top-level *.md (README, POLICY, CONTRIBUTING, SPONSORS, AGENTS, …)
 * - docs/ recursively when present
 * - src/content/ recursively (site issue posts)
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdown(dir, relativeBase = '') {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.join(relativeBase, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdown(abs, rel)));
    } else if (entry.isFile() && /\.mdx?$/i.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

/** Relative paths from repo root, sorted. */
export async function listMarkdownPaths() {
  const rootFiles = (await readdir(ROOT))
    .filter((name) => /\.mdx?$/i.test(name))
    .sort();

  const docs = (await walkMarkdown(path.join(ROOT, 'docs'), 'docs')).sort();
  const content = (await walkMarkdown(path.join(ROOT, 'src/content'), 'src/content')).sort();

  return [...rootFiles, ...docs, ...content];
}

export function absoluteMarkdownPaths(relPaths) {
  return relPaths.map((rel) => path.join(ROOT, rel));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  for (const p of await listMarkdownPaths()) console.log(p);
}
