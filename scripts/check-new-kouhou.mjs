#!/usr/bin/env node
/**
 * Guard: new-kouhou listing helpers (discoveredAt window by JST calendar day).
 */
import assert from 'node:assert/strict';

function previousIssuePubDate(posts, pubDate) {
  const older = posts
    .filter((p) => p.pubDate.valueOf() < pubDate.valueOf())
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
  return older[0]?.pubDate;
}

/** YYYY-MM-DD in Asia/Tokyo. */
function calendarDayJst(input) {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.valueOf())) return undefined;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function listNewKouhouIssues(issues, previousPubDate) {
  if (!previousPubDate) return [];
  const sinceDay = calendarDayJst(previousPubDate);
  if (!sinceDay) return [];
  return issues.filter((e) => {
    const raw = e.discoveredAt;
    if (!raw) return false;
    const day = calendarDayJst(raw);
    return Boolean(day && day > sinceDay);
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
  // Same calendar day as previous pubDate (vol pipeline run) — must NOT count as new
  { id: 'same-day', discoveredAt: '2026-10-31T00:01:33.000Z' },
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

// vol-3 window vs vol-2 pubDate: only discoveries after 2026-11-07 JST
const vol2 = new Date('2026-11-07T00:00:00Z');
const vol3Window = [
  { id: 'vol2-batch', discoveredAt: '2026-11-07T00:01:33.416Z' },
  { id: 'vol3-new', discoveredAt: '2026-11-14T05:06:59.206Z' },
];
assert.deepEqual(
  listNewKouhouIssues(vol3Window, vol2).map((i) => i.id),
  ['vol3-new'],
);

console.log('check:new-kouhou: ok');
