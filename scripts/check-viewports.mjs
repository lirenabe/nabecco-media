#!/usr/bin/env node
/**
 * Runtime media-query / viewport checks (375, 768, 1280):
 * - no documentElement horizontal overflow
 * - <main> is visible and has a box
 * - hamburger toggle is visible and can open/close the panel
 * - open panel stays within the viewport (no overflow from the menu)
 */
import { chromium } from 'playwright';
import { startPreview } from './preview.mjs';

const BASE = 'http://127.0.0.1:4325';
const ROUTES = ['/', '/issues/', '/issues/vol-1/'];
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const { child, ready } = startPreview(4325);
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

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        if (overflow.scrollWidth > overflow.clientWidth + 1) {
          throw new Error(
            `horizontal overflow (${overflow.scrollWidth} > ${overflow.clientWidth})`,
          );
        }

        const main = page.locator('main');
        if (!(await main.isVisible())) throw new Error('<main> not visible');
        const box = await main.boundingBox();
        if (!box || box.width < 200 || box.height < 40) {
          throw new Error('<main> box too small or missing');
        }

        const toggle = page.locator('[data-menu-toggle]');
        if (!(await toggle.isVisible())) throw new Error('hamburger toggle not visible');

        await toggle.click();
        await page.waitForFunction(
          () => document.querySelector('[data-menu-toggle]')?.getAttribute('aria-expanded') === 'true',
        );
        const panel = page.locator('[data-menu-panel]');
        if (!(await panel.isVisible())) throw new Error('menu panel not visible after open');

        const panelBox = await panel.boundingBox();
        if (panelBox) {
          if (panelBox.x < -1 || panelBox.x + panelBox.width > vp.width + 1) {
            throw new Error('open menu overflows viewport horizontally');
          }
        }

        await page.keyboard.press('Escape');
        await page.waitForFunction(
          () => document.querySelector('[data-menu-toggle]')?.getAttribute('aria-expanded') === 'false',
        );

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
  console.error('\nViewport check failed:\n');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('\nViewport / media-query runtime check passed.');
