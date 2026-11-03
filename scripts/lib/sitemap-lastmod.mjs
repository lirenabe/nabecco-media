/**
 * Build a map of sitemap URL → lastmod (YYYY-MM-DD) from tracked content.
 * Used by astro.config sitemap serialize.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * @param {string} raw
 * @param {string} key
 * @returns {string | undefined}
 */
function fmString(raw, key) {
  const m = new RegExp(`^${key}:\\s*"([^"]*)"`, 'm').exec(raw);
  if (m?.[1]) return m[1].trim();
  const m2 = new RegExp(`^${key}:\\s*'([^']*)'`, 'm').exec(raw);
  if (m2?.[1]) return m2[1].trim();
  const m3 = new RegExp(`^${key}:\\s*(\\S+)`, 'm').exec(raw);
  return m3?.[1]?.trim();
}

/**
 * @param {string | undefined} iso
 * @returns {string | undefined} YYYY-MM-DD
 */
function toDay(iso) {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Keep the later of two YYYY-MM-DD strings.
 * @param {string | undefined} a
 * @param {string | undefined} b
 */
function maxDay(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * @param {string} [root]
 * @param {string} [site]
 * @returns {Map<string, string>} full URL → YYYY-MM-DD
 */
export function buildSitemapLastmodMap(root = process.cwd(), site = 'https://nabecco.media') {
  /** @type {Map<string, string>} */
  const byPath = new Map();
  const origin = site.replace(/\/$/, '');

  let latestPostDay;
  const postsDir = path.join(root, 'src/content/posts');
  for (const name of readdirSync(postsDir)) {
    if (!name.endsWith('.md') || name.startsWith('.')) continue;
    const raw = readFileSync(path.join(postsDir, name), 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    if (/^draft:\s*true\s*$/m.test(fm[1])) continue;
    const pub = fmString(fm[1], 'pubDate');
    const day = toDay(pub?.includes('T') ? pub : pub ? `${pub}T00:00:00Z` : undefined);
    if (!day) continue;
    const id = name.replace(/\.md$/, '');
    byPath.set(`/issues/${id}/`, day);
    latestPostDay = maxDay(latestPostDay, day);
  }
  if (latestPostDay) {
    byPath.set('/', latestPostDay);
    byPath.set('/issues/', latestPostDay);
  }

  /** @type {Map<string, string>} */
  const muniMax = new Map();
  let kouhouMax;
  const kouhouDir = path.join(root, 'src/content/kouhou');
  for (const name of readdirSync(kouhouDir)) {
    if (!name.endsWith('.md') || name.startsWith('.')) continue;
    const raw = readFileSync(path.join(kouhouDir, name), 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;
    const muniId = fmString(fm[1], 'muniId');
    const yearMonth = fmString(fm[1], 'yearMonth');
    if (!muniId || !yearMonth) continue;
    const generated = toDay(fmString(fm[1], 'generatedAt'));
    const discovered = toDay(fmString(fm[1], 'discoveredAt'));
    const day = generated || discovered || `${yearMonth}-01`;
    byPath.set(`/kouhou/${muniId}/${yearMonth}/`, day);
    muniMax.set(muniId, maxDay(muniMax.get(muniId), day) ?? day);
    kouhouMax = maxDay(kouhouMax, day);
  }
  for (const [muniId, day] of muniMax) {
    byPath.set(`/kouhou/${muniId}/`, day);
  }
  if (kouhouMax) {
    byPath.set('/kouhou/', kouhouMax);
    byPath.set('/events/', kouhouMax);
  }

  /** @type {Map<string, string>} */
  const byUrl = new Map();
  for (const [pathname, day] of byPath) {
    byUrl.set(`${origin}${pathname}`, day);
  }
  return byUrl;
}
