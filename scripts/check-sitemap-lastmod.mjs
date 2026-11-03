#!/usr/bin/env node
/**
 * Smoke checks for sitemap lastmod map from content files.
 */
import { buildSitemapLastmodMap } from './lib/sitemap-lastmod.mjs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`check:sitemap-lastmod: ${msg}`);
    process.exit(1);
  }
}

const map = buildSitemapLastmodMap();
assert(map.has('https://nabecco.media/'), 'missing /');
assert(map.has('https://nabecco.media/kouhou/'), 'missing /kouhou/');
assert(
  map.has('https://nabecco.media/kouhou/city-akita/2026-10/'),
  'missing city-akita 2026-10',
);
assert(
  map.get('https://nabecco.media/kouhou/city-akita/') ===
    map.get('https://nabecco.media/kouhou/city-akita/2026-10/'),
  'muni top lastmod should match its issue when only one',
);

const rootDay = map.get('https://nabecco.media/');
assert(/^\d{4}-\d{2}-\d{2}$/.test(rootDay ?? ''), `bad / lastmod: ${rootDay}`);

console.log(`check:sitemap-lastmod: ok (${map.size} urls)`);
