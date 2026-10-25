#!/usr/bin/env node
/**
 * Download latest 広報 PDFs per sources/municipalities.yaml.
 * Failures are reported per source; the run continues.
 *
 * Usage:
 *   npm run fetch:kouhou
 *   npm run fetch:kouhou -- --only pref-akita,city-yokote
 *   npm run fetch:kouhou -- --include-incomplete
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractHrefs, fetchBinary, fetchText, pickHref } from './lib/http.mjs';
import { loadSources, sourceOutPath } from './lib/sources.mjs';

function parseArgs(argv) {
  const opts = { only: null, includeIncomplete: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') opts.only = new Set(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--include-incomplete') opts.includeIncomplete = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

async function resolvePdfUrl(source, defaults) {
  const f = source.fetch || {};
  const strategy = f.strategy || 'skip';
  const ua = defaults.userAgent;
  const timeoutMs = defaults.timeoutMs || 45000;

  if (strategy === 'skip') {
    return { skipped: true, reason: source.status === 'incomplete' ? 'incomplete' : 'strategy=skip' };
  }

  if (strategy === 'listing-pdf') {
    const page = await fetchText(source.listingUrl, { userAgent: ua, timeoutMs });
    const hrefs = extractHrefs(page.text, page.url);
    const pdf = pickHref(hrefs, {
      pattern: f.pdfHrefPattern || '\\.pdf($|\\?)',
      preferPattern: f.preferHrefPattern,
      excludePattern: f.excludeHrefPattern,
      pick: f.pick || 'first',
    });
    if (!pdf) throw new Error('no PDF link on listing page');
    return { pdfUrl: pdf, listingUrl: page.url };
  }

  if (strategy === 'issue-then-pdf') {
    const listing = await fetchText(source.listingUrl, { userAgent: ua, timeoutMs });
    const listingHrefs = extractHrefs(listing.text, listing.url);
    const issueUrl = pickHref(listingHrefs, {
      pattern: f.issueHrefPattern,
      pick: f.pick || 'first',
    });
    if (!issueUrl) throw new Error('no issue page link on listing');
    const issue = await fetchText(issueUrl, { userAgent: ua, timeoutMs });
    const issueHrefs = extractHrefs(issue.text, issue.url);
    const pdf = pickHref(issueHrefs, {
      pattern: f.pdfHrefPattern || '\\.pdf($|\\?)',
      preferPattern: f.preferHrefPattern,
      excludePattern: f.excludeHrefPattern,
      pick: f.pdfPick || 'first',
    });
    if (!pdf) throw new Error(`no PDF on issue page ${issueUrl}`);
    return { pdfUrl: pdf, listingUrl: listing.url, issueUrl: issue.url };
  }

  throw new Error(`unknown strategy: ${strategy}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/fetch-kouhou.mjs [--only id1,id2] [--include-incomplete] [--dry-run]`);
    process.exit(0);
  }

  const { sources, defaults, root } = await loadSources();
  const outDir = defaults.outDir || 'data/kouhou';
  await mkdir(path.join(root, outDir), { recursive: true });
  await mkdir(path.join(root, 'data/reports'), { recursive: true });

  const selected = sources.filter((s) => {
    if (opts.only && !opts.only.has(s.id)) return false;
    if (!opts.includeIncomplete && s.status === 'incomplete') return false;
    return true;
  });

  const results = [];
  console.log(`fetch-kouhou: ${selected.length} source(s) (of ${sources.length} total)\n`);

  for (const source of selected) {
    const row = { id: source.id, name: source.name, status: source.status, ok: false };
    try {
      if (source.status === 'incomplete' && (source.fetch?.strategy || 'skip') === 'skip') {
        row.ok = true;
        row.skipped = true;
        row.reason = 'incomplete/skip';
        console.log(`SKIP  ${source.id}  (${source.name}) — incomplete`);
        results.push(row);
        continue;
      }

      const resolved = await resolvePdfUrl(source, defaults);
      if (resolved.skipped) {
        row.ok = true;
        row.skipped = true;
        row.reason = resolved.reason;
        console.log(`SKIP  ${source.id}  — ${resolved.reason}`);
        results.push(row);
        continue;
      }

      row.pdfUrl = resolved.pdfUrl;
      row.issueUrl = resolved.issueUrl;
      if (opts.dryRun) {
        row.ok = true;
        row.dryRun = true;
        console.log(`DRY   ${source.id}  → ${resolved.pdfUrl}`);
        results.push(row);
        continue;
      }

      const { buf, url } = await fetchBinary(resolved.pdfUrl, {
        userAgent: defaults.userAgent,
        timeoutMs: defaults.timeoutMs || 45000,
      });
      if (buf.length < 5 || buf.subarray(0, 4).toString('utf8') !== '%PDF') {
        throw new Error(`not a PDF (${buf.length} bytes) from ${url}`);
      }
      const outPath = sourceOutPath(root, outDir, source, url);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, buf);
      row.ok = true;
      row.bytes = buf.length;
      row.path = path.relative(root, outPath);
      console.log(`OK    ${source.id}  ${row.path}  (${buf.length} bytes)`);
    } catch (err) {
      row.ok = false;
      row.error = err.message || String(err);
      console.error(`FAIL  ${source.id}  ${row.error}`);
    }
    results.push(row);
  }

  const reportPath = path.join(
    root,
    'data/reports',
    `fetch-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const ok = results.filter((r) => r.ok && !r.skipped && !r.dryRun).length;
  const skipped = results.filter((r) => r.skipped || r.dryRun).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nDone. ok=${ok} skipped=${skipped} fail=${fail}`);
  console.log(`Report: ${path.relative(root, reportPath)}`);
  // Non-zero only if every attempted active source failed and none succeeded.
  if (fail > 0 && ok === 0 && selected.some((s) => s.status === 'active')) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
