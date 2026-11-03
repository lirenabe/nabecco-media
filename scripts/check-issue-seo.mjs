#!/usr/bin/env node
/**
 * Smoke checks for reading-layer Article JSON-LD helper.
 */
import { issueArticleJsonLd } from '../src/lib/issue-seo.ts';

function assert(cond, msg) {
  if (!cond) {
    console.error(`check:issue-seo: ${msg}`);
    process.exit(1);
  }
}

const site = new URL('https://nabecco.media/');
const latest = issueArticleJsonLd(
  {
    id: 'vol-1',
    title: '潟上市と都城市の協定',
    description: 'desc',
    pubDate: new Date('2026-10-31T00:00:00Z'),
    imagePath: '/images/pickup.png',
    pathname: '/',
  },
  site,
);

assert(latest['@graph']?.length === 1, 'latest should be Article only');
assert(latest['@graph'][0]['@type'] === 'Article', 'missing Article');
assert(latest['@graph'][0].datePublished === '2026-10-31', 'bad datePublished');
assert(
  latest['@graph'][0].image[0] === 'https://nabecco.media/images/pickup.png',
  'bad image url',
);

const past = issueArticleJsonLd(
  {
    id: 'vol-1',
    title: '潟上市と都城市の協定',
    description: 'desc',
    pubDate: new Date('2026-10-31T00:00:00Z'),
    imagePath: '/og.png',
    pathname: '/issues/vol-1/',
    includeBackIssuesCrumb: true,
  },
  site,
);
assert(past['@graph']?.length === 2, 'past issue should include breadcrumbs');
assert(past['@graph'][0]['@type'] === 'BreadcrumbList', 'missing BreadcrumbList');

console.log('check:issue-seo: ok');
