#!/usr/bin/env node
/**
 * axe-core a11y + responsive smoke (375 / 1280) on key routes after astro preview.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { startPreview } from './preview.mjs';

const BASE = 'http://127.0.0.1:4323';
const ROUTES = ['/', '/issues/', '/issues/vol-1/'];
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function checkOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  if (overflow.scrollWidth > overflow.clientWidth + 1) {
    throw new Error(
      `${label}: horizontal overflow (scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth})`,
    );
  }
}

const { child, ready } = startPreview(4323);
await ready;

const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const label = `${route} @ ${vp.name}`;
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
        await checkOverflow(page, label);

        if (vp.name === 'desktop') {
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();
          const serious = results.violations.filter((v) =>
            ['critical', 'serious'].includes(v.impact || ''),
          );
          if (serious.length) {
            for (const v of serious) {
              failures.push(
                `${label}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s))`,
              );
            }
          }
        }
        console.log(`ok ${label}`);
      } catch (err) {
        failures.push(`${label}: ${err.message || err}`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  child.kill('SIGTERM');
}

if (failures.length) {
  console.error('\nA11y / responsive failures:\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nA11y + responsive smoke passed.');
