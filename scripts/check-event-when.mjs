#!/usr/bin/env node
/**
 * Guard: event `when` parsing / upcoming filter (no file-path tricks).
 */
import {
  eventSortKey,
  isEventUpcoming,
  parseEventWhen,
} from '../src/lib/event-when.ts';

function fail(msg) {
  console.error(`check:event-when: ${msg}`);
  process.exit(1);
}

const range = parseEventWhen('2026年10月1日〜11月10日', '2026-10');
if (range.startDate !== '2026-10-01' || range.endDate !== '2026-11-10') {
  fail(`range parse unexpected: ${JSON.stringify(range)}`);
}

const crossYear = parseEventWhen('2026年12月1日〜2月1日', '2026-11');
if (crossYear.startDate !== '2026-12-01' || crossYear.endDate !== '2027-02-01') {
  fail(`cross-year range unexpected: ${JSON.stringify(crossYear)}`);
}

const reiwa = parseEventWhen('2026年10月1日〜令和9年2月28日', '2026-10');
if (reiwa.endDate !== '2027-02-28') fail(`reiwa end unexpected: ${JSON.stringify(reiwa)}`);

const single = parseEventWhen('2026年11月13日 13:30〜15:30', '2026-11');
if (single.startDate !== '2026-11-13' || single.endDate !== '2026-11-13') {
  fail(`single day unexpected: ${JSON.stringify(single)}`);
}

const today = '2026-11-03';
if (isEventUpcoming('2026年10月24日〜11月2日', parseEventWhen('2026年10月24日〜11月2日'), '2026-10', today)) {
  fail('ended range should be dropped');
}
if (!isEventUpcoming('2026年11月13日', parseEventWhen('2026年11月13日'), '2026-11', today)) {
  fail('future single day should be kept');
}
if (!isEventUpcoming('2026年10月1日から', parseEventWhen('2026年10月1日から'), '2026-10', today)) {
  fail('open-ended から should be kept');
}
if (!isEventUpcoming('秋の講座（詳細は原本）', {}, '2026-11', today)) {
  fail('unparseable current-month should be kept');
}
if (isEventUpcoming('秋の講座（詳細は原本）', {}, '2026-09', today)) {
  fail('unparseable past month should be dropped');
}

const sk = eventSortKey(range, '2026-10', 'x');
if (sk !== '2026-10-01') fail(`sort key unexpected: ${sk}`);

console.log('check:event-when: ok');
