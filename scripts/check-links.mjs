#!/usr/bin/env node
/**
 * Link checks:
 * 1) markdown-link-check on shared Markdown set (site content + non-site docs)
 * 2) guard against mangled bare autolinks (e.g. URL glued to fullwidth 「（」)
 * 3) linkinator crawl of built site via astro preview (CI / npm run check:links)
 *
 * Production nabecco.media URLs in built HTML (canonical / og:*) are skipped in
 * the site crawl because HTTPS for the custom domain may lag DNS; shape is
 * asserted by check-seo.mjs. Markdown docs must not ignore nabecco.media /
 * github.io — use a working Pages URL until custom-domain HTTPS is ready.
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { absoluteMarkdownPaths, listMarkdownPaths } from './markdown-paths.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

/** True when an http(s) URL contains non-ASCII after percent-decoding (e.g. glued「（」). */
function isMangledHttpUrl(url) {
  if (!/^https?:\/\//i.test(url)) return false;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return true;
  }
  return /[^\x21-\x7E]/.test(decoded);
}

/** Catch bare URLs that swallowed trailing Japanese punctuation into the href. */
async function assertCleanHttpLinks(file) {
  const { default: extract } = await import('markdown-link-extractor');
  const md = await readFile(file, 'utf8');
  const links = extract(md);
  const bad = links.filter(isMangledHttpUrl);
  if (bad.length) {
    const rel = path.relative(ROOT, file);
    const detail = bad.map((u) => `  - ${u}`).join('\n');
    throw new Error(
      `${rel}: mangled http(s) autolink(s) — put labels outside the URL or use [text](url):\n${detail}`,
    );
  }
}

async function checkMarkdown(explicitFiles = []) {
  const mlc = path.join(ROOT, 'node_modules/markdown-link-check/markdown-link-check');
  const config = path.join(ROOT, '.markdown-link-check.json');
  const relPaths = explicitFiles.length ? explicitFiles : await listMarkdownPaths();
  const files = absoluteMarkdownPaths(relPaths);

  if (!files.length) {
    throw new Error('No Markdown files found for link check');
  }

  console.log(`markdown-link-check (${files.length} files)`);
  for (const file of files) {
    console.log(`\n[md] ${path.relative(ROOT, file)}`);
    await assertCleanHttpLinks(file);
    // Non-quiet so ignored/skipped links stay visible in CI logs.
    await run(process.execPath, [mlc, '-c', config, file]);
  }
}

async function checkSite() {
  const { LinkChecker } = await import('linkinator');
  const preview = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules/astro/bin/astro.mjs'), 'preview', '--host', '127.0.0.1', '--port', '4322'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let settled = false;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview timeout')), 60000);
    const onData = (buf) => {
      const s = buf.toString();
      process.stderr.write(s);
      if (!settled && /localhost:4322|127\.0\.0\.1:4322|Local/.test(s)) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    };
    preview.stdout.on('data', onData);
    preview.stderr.on('data', onData);
    preview.on('exit', (code) => {
      if (settled) return;
      clearTimeout(timer);
      reject(new Error(`preview exited early (${code})`));
    });
  });

  try {
    const checker = new LinkChecker();
    const result = await checker.check({
      path: 'http://127.0.0.1:4322/',
      recurse: true,
      concurrency: 8,
      timeout: 15000,
      linksToSkip: [
        /^https?:\/\/github\.com\//,
        /^https?:\/\/fonts\.googleapis\.com\//,
        /^https?:\/\/fonts\.gstatic\.com\//,
        // Production absolute URLs in canonical / og:*; DNS is operator-side.
        // Presence and shape are asserted in check-seo.mjs; assets are served locally.
        /^https?:\/\/nabecco\.media\//,
        // Same host as .markdown-link-check.json: CI で Status: 0 が断続する自治体サイト。
        /^https?:\/\/vill\.higashinaruse\.lg\.jp\//,
      ],
    });
    const broken = result.links.filter((l) => l.state === 'BROKEN');
    if (broken.length) {
      console.error('\nBroken links in preview crawl:');
      for (const l of broken) console.error(`  ${l.status} ${l.url} (from ${l.parent})`);
      throw new Error(`${broken.length} broken link(s)`);
    }
    console.log(`\nSite crawl passed (${result.links.length} links checked).`);
  } finally {
    preview.kill('SIGTERM');
  }
}

const mode = process.argv[2] || 'all';
const extra = process.argv.slice(3).filter((a) => !a.startsWith('-'));
if (mode === 'md') await checkMarkdown(extra);
else if (mode === 'site') await checkSite();
else {
  await checkMarkdown();
  await checkSite();
}
