/**
 * Resolve the latest published post id from src/content/posts/*.md
 * (draft !== true, newest pubDate). Used by astro.config sitemap filter.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * @param {string} [root]
 * @returns {string | null} post id (filename without .md), or null
 */
export function latestPublishedPostId(root = process.cwd()) {
  const dir = path.join(root, 'src/content/posts');
  let best = null;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.md') || name.startsWith('.')) continue;
    const raw = readFileSync(path.join(dir, name), 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const body = fm[1];
    if (/^draft:\s*true\s*$/m.test(body)) continue;
    const m = body.match(/^pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m);
    if (!m) continue;
    const id = name.replace(/\.md$/, '');
    const t = Date.parse(`${m[1]}T00:00:00Z`);
    if (!best || t > best.t) best = { id, t };
  }
  return best?.id ?? null;
}
