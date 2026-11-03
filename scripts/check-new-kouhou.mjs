#!/usr/bin/env node
/**
 * Guard: new-kouhou listing helpers (discoveredAt window).
 */
import assert from 'node:assert/strict';

function previousIssuePubDate(posts, pubDate) {
  const older = posts
    .filter((p) => p.pubDate.valueOf() < pubDate.valueOf())
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
  return older[0]?.pubDate;
}

function listNewKouhouIssues(issues, previousPubDate) {
  if (!previousPubDate) return [];
  const since = previousPubDate.valueOf();
  return issues.filter((e) => {
    const raw = e.discoveredAt;
    if (!raw) return false;
    const t = Date.parse(raw);
    return !Number.isNaN(t) && t > since;
  });
}

const d1 = new Date('2026-10-31T00:00:00Z');
const d2 = new Date('2026-11-07T00:00:00Z');
const posts = [{ pubDate: d1 }, { pubDate: d2 }];

assert.equal(previousIssuePubDate(posts, d1), undefined);
assert.equal(previousIssuePubDate(posts, d2)?.toISOString().slice(0, 10), '2026-10-31');

const issues = [
  { id: 'old', discoveredAt: undefined },
  { id: 'before', discoveredAt: '2026-10-20T00:00:00.000Z' },
  { id: 'after', discoveredAt: '2026-11-03T00:00:00.000Z' },
];

assert.deepEqual(
  listNewKouhouIssues(issues, undefined).map((i) => i.id),
  [],
);
assert.deepEqual(
  listNewKouhouIssues(issues, d1).map((i) => i.id),
  ['after'],
);

console.log('check:new-kouhou: ok');
