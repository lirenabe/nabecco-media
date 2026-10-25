#!/usr/bin/env node
/**
 * Step A — PDF取得: download latest 広報 PDFs per sources/municipalities.yaml.
 * Skip-if-unchanged via data/kouhou/manifest.json (sha256 + optional etag/last-modified).
 * Failures are reported per source; the run continues.
 *
 * Usage:
 *   npm run fetch:kouhou
 *   npm run fetch:kouhou -- --only pref-akita,city-yokote
 *   npm run fetch:kouhou -- --dry-run
 *   npm run fetch:kouhou -- --force
 */
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractAnchors, fetchBinary, fetchText, pickHref, sleep } from './lib/http.mjs';
import {
  getEntry,
  loadManifest,
  saveManifest,
  setEntry,
  sha256Buffer,
  stablePdfRelPath,
} from './lib/manifest.mjs';
import { loadSources } from './lib/sources.mjs';

const POLITE_DELAY_MS = 800;

function parseArgs(argv) {
  const opts = { only: null, includeIncomplete: false, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') opts.only = new Set(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--include-incomplete') opts.includeIncomplete = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
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
    const anchors = extractAnchors(page.text, page.url);
    const pdf = pickHref(anchors, {
      pattern: f.pdfHrefPattern || '\\.pdf($|\\?)',
      preferPattern: f.preferHrefPattern,
      preferTextPattern: f.preferTextPattern,
      excludePattern: f.excludeHrefPattern,
      excludeTextPattern: f.excludeTextPattern,
      textPattern: f.pdfTextPattern,
      pick: f.pick || 'first',
    });
    if (!pdf) throw new Error('no PDF link on listing page');
    return { pdfUrl: pdf, listingUrl: page.url };
  }

  if (strategy === 'issue-then-pdf') {
    const listing = await fetchText(source.listingUrl, { userAgent: ua, timeoutMs });
    const listingAnchors = extractAnchors(listing.text, listing.url);
    const issueUrl = pickHref(listingAnchors, {
      pattern: f.issueHrefPattern,
      textPattern: f.issueTextPattern,
      preferPattern: f.preferIssueHrefPattern,
      preferTextPattern: f.preferIssueTextPattern,
      excludePattern: f.excludeIssueHrefPattern,
      excludeTextPattern: f.excludeIssueTextPattern,
      pick: f.pick || 'first',
    });
    if (!issueUrl) throw new Error('no issue page link on listing');
    await sleep(POLITE_DELAY_MS);
    const issue = await fetchText(issueUrl, { userAgent: ua, timeoutMs });
    const issueAnchors = extractAnchors(issue.text, issue.url);
    const pdf = pickHref(issueAnchors, {
      pattern: f.pdfHrefPattern || '\\.pdf($|\\?)',
      preferPattern: f.preferHrefPattern,
      preferTextPattern: f.preferTextPattern,
      excludePattern: f.excludeHrefPattern,
      excludeTextPattern: f.excludeTextPattern,
      textPattern: f.pdfTextPattern,
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
    console.log(
      `Usage: node scripts/fetch-kouhou.mjs [--only id1,id2] [--include-incomplete] [--dry-run] [--force]
  Step A: download PDFs only. Uses data/kouhou/manifest.json for skip-if-unchanged.`,
    );
    process.exit(0);
  }

  const { sources, defaults, root } = await loadSources();
  await mkdir(path.join(root, 'data/kouhou'), { recursive: true });
  await mkdir(path.join(root, 'data/reports'), { recursive: true });
  const { doc: manifest } = await loadManifest(root);

  const selected = sources.filter((s) => {
    if (opts.only && !opts.only.has(s.id)) return false;
    if (!opts.includeIncomplete && s.status === 'incomplete') return false;
    return true;
  });

  const results = [];
  console.log(`fetch-kouhou (Step A): ${selected.length} source(s) (of ${sources.length} total)\n`);

  for (let i = 0; i < selected.length; i++) {
    const source = selected[i];
    if (i > 0) await sleep(POLITE_DELAY_MS);
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

      const relPath = stablePdfRelPath(source);
      const absPath = path.join(root, relPath);
      const prev = getEntry(manifest, source.id);
      const sameUrl = prev?.url === resolved.pdfUrl;
      const localOk = prev?.path && (await fileExists(path.join(root, prev.path)));

      let buf;
      let etag = '';
      let lastModified = '';
      let finalUrl = resolved.pdfUrl;
      let cacheHit = false;

      if (!opts.force && sameUrl && localOk && (prev.etag || prev.lastModified)) {
        const cond = await fetchBinary(resolved.pdfUrl, {
          userAgent: defaults.userAgent,
          timeoutMs: defaults.timeoutMs || 45000,
          etag: prev.etag || '',
          lastModified: prev.lastModified || '',
        });
        if (cond.notModified) {
          cacheHit = true;
          etag = cond.etag || prev.etag || '';
          lastModified = cond.lastModified || prev.lastModified || '';
          finalUrl = cond.url || resolved.pdfUrl;
          setEntry(manifest, source.id, {
            ...prev,
            url: resolved.pdfUrl,
            etag,
            lastModified,
            path: prev.path || relPath,
            fetchedAt: new Date().toISOString(),
            cache: 'http-304',
          });
          row.ok = true;
          row.cached = true;
          row.cache = 'http-304';
          row.path = prev.path || relPath;
          row.sha256 = prev.sha256;
          row.bytes = prev.bytes;
          console.log(`CACHE ${source.id}  HTTP 304  ${row.path}`);
          results.push(row);
          continue;
        }
        buf = cond.buf;
        etag = cond.etag || '';
        lastModified = cond.lastModified || '';
        finalUrl = cond.url;
      } else {
        const got = await fetchBinary(resolved.pdfUrl, {
          userAgent: defaults.userAgent,
          timeoutMs: defaults.timeoutMs || 45000,
        });
        buf = got.buf;
        etag = got.etag || '';
        lastModified = got.lastModified || '';
        finalUrl = got.url;
      }

      if (!buf || buf.length < 5 || buf.subarray(0, 4).toString('utf8') !== '%PDF') {
        throw new Error(`not a PDF (${buf?.length || 0} bytes) from ${finalUrl}`);
      }

      const sha256 = sha256Buffer(buf);
      if (!opts.force && sameUrl && localOk && prev.sha256 && prev.sha256 === sha256) {
        cacheHit = true;
        setEntry(manifest, source.id, {
          ...prev,
          url: resolved.pdfUrl,
          sha256,
          etag: etag || prev.etag || '',
          lastModified: lastModified || prev.lastModified || '',
          path: prev.path || relPath,
          bytes: buf.length,
          fetchedAt: new Date().toISOString(),
          cache: 'sha256-match',
        });
        row.ok = true;
        row.cached = true;
        row.cache = 'sha256-match';
        row.path = prev.path || relPath;
        row.sha256 = sha256;
        row.bytes = buf.length;
        console.log(`CACHE ${source.id}  sha256 match  ${row.path}`);
        results.push(row);
        continue;
      }

      await mkdir(path.dirname(absPath), { recursive: true });
      await writeFile(absPath, buf);
      setEntry(manifest, source.id, {
        id: source.id,
        name: source.name,
        url: resolved.pdfUrl,
        finalUrl,
        sha256,
        etag,
        lastModified,
        path: relPath,
        bytes: buf.length,
        listingUrl: resolved.listingUrl || source.listingUrl,
        issueUrl: resolved.issueUrl || '',
        fetchedAt: new Date().toISOString(),
        cache: cacheHit ? 'rewrote' : 'downloaded',
      });
      row.ok = true;
      row.bytes = buf.length;
      row.path = relPath;
      row.sha256 = sha256;
      console.log(`OK    ${source.id}  ${relPath}  (${buf.length} bytes)`);
    } catch (err) {
      row.ok = false;
      row.error = err.message || String(err);
      console.error(`FAIL  ${source.id}  ${row.error}`);
    }
    results.push(row);
  }

  await saveManifest(root, manifest);

  const reportPath = path.join(
    root,
    'data/reports',
    `fetch-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const ok = results.filter((r) => r.ok && !r.skipped && !r.dryRun && !r.cached).length;
  const cached = results.filter((r) => r.cached).length;
  const skipped = results.filter((r) => r.skipped || r.dryRun).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nDone. downloaded=${ok} cached=${cached} skipped=${skipped} fail=${fail}`);
  console.log(`Manifest: data/kouhou/manifest.json`);
  console.log(`Report: ${path.relative(root, reportPath)}`);
  if (fail > 0 && ok === 0 && cached === 0 && selected.some((s) => s.status === 'active')) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
