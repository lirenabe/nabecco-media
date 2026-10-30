#!/usr/bin/env node
/**
 * SEO + OGP essentials on built HTML (preview):
 * - <html lang>
 * - <title>, meta description
 * - canonical absolute URL on nabecco.media
 * - Open Graph: title, description, type, url, image, locale, site_name
 * - Twitter card basics
 * - robots.txt + sitemap-index.xml exist and reference each other
 */
import { startPreview } from './preview.mjs';

const BASE = 'http://127.0.0.1:4324';
const SITE = 'https://nabecco.media';
const OG_IMAGE = `${SITE}/og.png`;
const ROUTES = ['/', '/issues/'];

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

  const ogAsset = await fetch(`${BASE}/og.png`);
  if (!ogAsset.ok) {
    failures.push(`og.png: HTTP ${ogAsset.status}`);
  } else {
    const buf = Buffer.from(await ogAsset.arrayBuffer());
    if (buf.length < 8 || buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      failures.push('og.png: not a PNG');
    }
  }

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
      ['og:image', attr(html, 'og:image') === OG_IMAGE],
      ['twitter:card', ['summary', 'summary_large_image'].includes(attr(html, 'twitter:card'))],
    ];
    for (const [name, ok] of checks) {
      if (!ok) failures.push(`${route}: missing/invalid ${name}`);
    }
    if (route === '/') {
      if (attr(html, 'og:type') !== 'website') {
        failures.push(`${route}: og:type should be website`);
      }
    } else if (attr(html, 'og:type') !== 'article') {
      failures.push(`${route}: og:type should be article`);
    }
    console.log(`ok ${route}`);
  }
} finally {
  child.kill('SIGTERM');
}

if (failures.length) {
  console.error('\nSEO / OGP check failed:\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nSEO / OGP check passed.');
