#!/usr/bin/env node
/**
 * SEO essentials on built HTML (preview):
 * - <html lang>
 * - <title>, meta description
 * - canonical absolute URL on nabecco.media
 * - Open Graph: type, title, description, url, locale, site_name
 * - robots.txt + sitemap-index.xml exist and reference each other
 */
import { startPreview } from './preview.mjs';

const BASE = 'http://127.0.0.1:4324';
const SITE = 'https://nabecco.media';
const ROUTES = ['/', '/issues/', '/issues/vol-1/'];

function attr(html, name, attrName = 'content') {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+${attrName}=["']([^"']+)["']`,
    'i',
  );
  const re2 = new RegExp(
    `<meta[^>]+${attrName}=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    'i',
  );
  return html.match(re)?.[1] || html.match(re2)?.[1] || '';
}

function linkHref(html, rel) {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`, 'i');
  return html.match(re)?.[1] || html.match(re2)?.[1] || '';
}

function title(html) {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || '';
}

function lang(html) {
  return html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || '';
}

const { child, ready } = startPreview(4324);
await ready;

const failures = [];

try {
  const robots = await fetch(`${BASE}/robots.txt`);
  if (!robots.ok) failures.push(`robots.txt: HTTP ${robots.status}`);
  else {
    const body = await robots.text();
    if (!/Sitemap:\s*https:\/\/nabecco\.media\/sitemap-index\.xml/i.test(body)) {
      failures.push('robots.txt: missing Sitemap: https://nabecco.media/sitemap-index.xml');
    }
  }

  const sitemap = await fetch(`${BASE}/sitemap-index.xml`);
  if (!sitemap.ok) failures.push(`sitemap-index.xml: HTTP ${sitemap.status}`);

  for (const route of ROUTES) {
    const res = await fetch(`${BASE}${route}`);
    if (!res.ok) {
      failures.push(`${route}: HTTP ${res.status}`);
      continue;
    }
    const html = await res.text();
    const expectedCanon = new URL(route, SITE).href;
    const checks = [
      ['lang=ja', lang(html) === 'ja'],
      ['title', title(html).length >= 2],
      ['meta description', attr(html, 'description').length >= 10],
      ['canonical', linkHref(html, 'canonical') === expectedCanon],
      ['og:title', attr(html, 'og:title').length >= 2],
      ['og:description', attr(html, 'og:description').length >= 10],
      ['og:url', attr(html, 'og:url') === expectedCanon],
      ['og:type', ['website', 'article'].includes(attr(html, 'og:type'))],
      ['og:locale', attr(html, 'og:locale') === 'ja_JP'],
      ['og:site_name', attr(html, 'og:site_name') === 'なべっこ'],
    ];
    for (const [name, ok] of checks) {
      if (!ok) failures.push(`${route}: missing/invalid ${name}`);
    }
    console.log(`ok ${route}`);
  }
} finally {
  child.kill('SIGTERM');
}

if (failures.length) {
  console.error('\nSEO check failed:\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nSEO check passed.');
