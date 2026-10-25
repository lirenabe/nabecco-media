#!/usr/bin/env node
/**
 * axe-core a11y on key routes (desktop). Overflow/hamburger coverage lives in
 * check-viewports.mjs (375 / 768 / 1280).
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { startPreview } from './preview.mjs';

const BASE = 'http://127.0.0.1:4323';
const ROUTES = ['/', '/issues/', '/issues/vol-1/'];

const { child, ready } = startPreview(4323);
await ready;

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const route of ROUTES) {
    const label = `${route} @ desktop`;
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations.filter((v) =>
        ['critical', 'serious'].includes(v.impact || ''),
      );
      if (serious.length) {
        for (const v of serious) {
          failures.push(`${label}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s))`);
        }
      } else {
        console.log(`ok ${label}`);
      }
    } catch (err) {
      failures.push(`${label}: ${err.message || err}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  child.kill('SIGTERM');
}

if (failures.length) {
  console.error('\nA11y failures:\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nA11y check passed.');
