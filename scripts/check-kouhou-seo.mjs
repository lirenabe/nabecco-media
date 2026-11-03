#!/usr/bin/env node
/**
 * Smoke checks for reference-layer SEO helpers (meta description from 案内).
 */
import {
  guideItemsFromBody,
  kouhouIssueMetaDescription,
} from '../src/lib/kouhou-seo.ts';

function assert(cond, msg) {
  if (!cond) {
    console.error(`check:kouhou-seo: ${msg}`);
    process.exit(1);
  }
}

const sampleBody = `---
ignored
---

<aside></aside>

## この号の案内

- 今冬の除排雪と高齢者宅の間口支援
- 保育施設への入所申請の受付
- 食品ロス削減月間のもったいないアクション

## 内容の要約

### 今冬の除排雪
`;

const items = guideItemsFromBody(sampleBody);
assert(items.length === 3, `expected 3 guide items, got ${items.length}`);
assert(items[0].includes('除排雪'), 'first guide item missing');

const entry = {
  body: sampleBody,
  data: {
    title: '秋田市 広報 2026年10月号',
    description: '秋田市の公式広報 2026年10月号の要約です。',
    muniId: 'city-akita',
    muniName: '秋田市',
    yearMonth: '2026-10',
    sourceUrl: 'https://example.invalid/a.pdf',
    listingUrl: 'https://example.invalid/',
  },
};

const desc = kouhouIssueMetaDescription(entry);
assert(desc.includes('秋田市の広報2026年10月号の要約'), `prefix missing: ${desc}`);
assert(desc.includes('除排雪'), `guide topic missing: ${desc}`);
assert(!desc.includes('公式広報 2026年10月号の要約です'), `should not use thin FM when guide exists: ${desc}`);
assert(desc.length <= 155, `description too long (${desc.length}): ${desc}`);

const thin = kouhouIssueMetaDescription({
  body: '## 出典\n\n- only',
  data: entry.data,
});
assert(thin === entry.data.description, `fallback should use frontmatter: ${thin}`);

console.log('check:kouhou-seo: ok');
