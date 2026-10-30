#!/usr/bin/env node
/**
 * Step B′ — 口コミ抽出: human-exported Threads HTML → structured posts
 * under data/kuchikomi/extracted/<YYYY-MM-DD>/{posts.json,posts.md}.
 *
 * Local files only. Does NOT fetch threads.com / Meta.
 *
 * Usage:
 *   npm run extract:kuchikomi -- --date 2026-11-01
 *   npm run extract:kuchikomi -- --date 2026-11-01 --force
 *   npm run extract:kuchikomi -- --date 2026-11-01 --input path/to/dump.html
 */
import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KUCHIKOMI_DIR = path.join(ROOT, 'data/kuchikomi');
const EXTRACTED_ROOT = path.join(KUCHIKOMI_DIR, 'extracted');

function parseArgs(argv) {
  const opts = { date: null, input: null, force: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--date') opts.date = argv[++i];
    else if (a === '--input') opts.input = path.resolve(argv[++i]);
    else if (a === '--force') opts.force = true;
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function sha256Text(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function decodeBasicEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(s) {
  return decodeBasicEntities(s.replace(/<[^>]+>/g, ''));
}

function normalizeWs(s) {
  return s.replace(/\s+/g, ' ').trim();
}

const RELATIVE_TIME_RE =
  /^(?:\d+\s*(?:秒|分|時間|日|週|か月|ヶ月|月|年)|たった今|now|yesterday|\d+\s*[smhdw])$/i;

function isChromeText(t, handle) {
  if (!t) return true;
  if (t === handle || t === `@${handle}`) return true;
  if (RELATIVE_TIME_RE.test(t)) return true;
  if (/^(Follow|フォロー|いいね|返信|再投稿|共有|Translate|翻訳)/i.test(t)) return true;
  if (/^(View on Threads|おはよう Threads|Threads)$/i.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^[\d.,]+(?:万)?$/.test(t)) return true;
  // Location / topic chips that appear as tiny dir=auto spans
  if (t.length <= 16 && /^(秋田|秋田県|秋田旅行|パワースポット|ラーメン)$/.test(t)) return true;
  return false;
}

/**
 * Resolve dump HTML path for a pubDate.
 * Prefers: --input → YYYY-MM-DD.threads.html → first *.html under YYYY-MM-DD/
 */
async function resolveDumpHtml(dateStr, input) {
  if (input) {
    if (!(await exists(input))) throw new Error(`--input not found: ${input}`);
    return input;
  }
  const flat = path.join(KUCHIKOMI_DIR, `${dateStr}.threads.html`);
  if (await exists(flat)) return flat;

  const dir = path.join(KUCHIKOMI_DIR, dateStr);
  if (!(await exists(dir))) {
    throw new Error(
      `No dump for ${dateStr}. Expected ${path.relative(ROOT, flat)} or ${path.relative(ROOT, dir)}/*.html`,
    );
  }
  const names = (await readdir(dir)).filter((n) => n.endsWith('.html') && !n.startsWith('.'));
  if (!names.length) throw new Error(`No .html under ${path.relative(ROOT, dir)}`);
  // Prefer browser “Save Page” names; else first sorted
  names.sort((a, b) => {
    const score = (n) => (/threads|保存/i.test(n) ? 0 : 1);
    return score(a) - score(b) || a.localeCompare(b);
  });
  return path.join(dir, names[0]);
}

function extractPosts(raw) {
  const permalinkRe = /https:\/\/www\.threads\.com\/@([\w.]+)\/post\/([A-Za-z0-9_-]+)/g;
  /** @type {{handle:string,id:string,index:number}[]} */
  const hits = [];
  const seen = new Set();
  for (const m of raw.matchAll(permalinkRe)) {
    const handle = m[1];
    const id = m[2];
    const key = `${handle}/${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ handle, id, index: m.index ?? 0 });
  }

  const handles = new Set(hits.map((h) => h.handle));
  const posts = [];

  for (let i = 0; i < hits.length; i++) {
    const { handle, id, index } = hits[i];
    const nextIndex = i + 1 < hits.length ? hits[i + 1].index : Math.min(raw.length, index + 24000);
    // Time/author often sit just before the permalink; body spans sit after it.
    // Do not extend forward past the next permalink (avoids next-post text leak).
    const pre = raw.slice(Math.max(0, index - 3000), index);
    const body = raw.slice(index, nextIndex);
    const mediaChunk = raw.slice(Math.max(0, index - 800), nextIndex);

    const timeMatch =
      pre.match(/<time[^>]*datetime="([^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>/i) ||
      body.match(/<time[^>]*datetime="([^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>/i);

    const spanParts = [];
    for (const sm of body.matchAll(/<span[^>]*dir="auto"[^>]*>(.*?)<\/span>/gis)) {
      const t = normalizeWs(stripTags(sm[1]));
      if (isChromeText(t, handle)) continue;
      if (handles.has(t) && t !== handle) continue; // neighboring author handle
      if (spanParts.length && spanParts[spanParts.length - 1] === t) continue;
      spanParts.push(t);
    }

    // Drop trailing neighbor handle / chip / place-name leak at end
    while (spanParts.length > 1) {
      const last = spanParts[spanParts.length - 1];
      if (handles.has(last) && last !== handle) spanParts.pop();
      else if (last.length <= 20 && !last.includes(' ') && !/[。！？!?]/.test(last)) {
        // short trailing token often next-post preview / UI chip
        spanParts.pop();
      } else break;
    }

    let mediaCount = 0;
    for (const im of mediaChunk.matchAll(/<img\b([^>]*)>/gi)) {
      const attrs = im[1];
      const altM = attrs.match(/alt="([^"]*)"/i);
      const alt = altM ? altM[1] : '';
      if (/プロフィール|profile photo/i.test(alt)) continue;
      const srcM = attrs.match(/src="([^"]+)"/i);
      if (!srcM) continue;
      mediaCount += 1;
    }
    const hasVideo = /<video\b/i.test(mediaChunk);

    posts.push({
      id,
      handle,
      permalink: `https://www.threads.com/@${handle}/post/${id}`,
      datetime: timeMatch?.[1] || null,
      datetimeLabel: timeMatch?.[2] || null,
      text: spanParts.join('\n').trim(),
      hasImage: mediaCount > 0,
      hasVideo,
      mediaCount,
    });
  }

  return posts;
}

function renderPostsMd(dateStr, sourceRel, posts) {
  const lines = [
    `# 口コミ抽出 ${dateStr}`,
    '',
    `- source: \`${sourceRel}\``,
    `- posts: ${posts.length}`,
    `- note: local HTML only — agent must not fetch threads.com`,
    '',
  ];
  for (const p of posts) {
    const media = [
      p.hasImage ? `images:${p.mediaCount}` : null,
      p.hasVideo ? 'video' : null,
    ]
      .filter(Boolean)
      .join(', ') || 'none';
    lines.push(`## @${p.handle} — ${p.id}`);
    lines.push('');
    lines.push(`- permalink: ${p.permalink}`);
    lines.push(`- datetime: ${p.datetime || '—'}${p.datetimeLabel ? ` (${p.datetimeLabel})` : ''}`);
    lines.push(`- media: ${media}`);
    lines.push('');
    lines.push(p.text || '_(empty text)_');
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.date) {
    console.log(`Usage: node scripts/extract-kuchikomi.mjs --date YYYY-MM-DD [--input html] [--force]
  Writes data/kuchikomi/extracted/<date>/posts.json and posts.md
  Never contacts threads.com.`);
    process.exit(opts.help ? 0 : 1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    console.error('Invalid --date (use YYYY-MM-DD)');
    process.exit(1);
  }

  const dumpAbs = await resolveDumpHtml(opts.date, opts.input);
  const dumpRel = path.relative(ROOT, dumpAbs);
  const raw = await readFile(dumpAbs, 'utf8');
  const hash = sha256Text(raw);
  const outDir = path.join(EXTRACTED_ROOT, opts.date);
  const jsonAbs = path.join(outDir, 'posts.json');
  const mdAbs = path.join(outDir, 'posts.md');

  if (!opts.force && (await exists(jsonAbs))) {
    try {
      const prev = JSON.parse(await readFile(jsonAbs, 'utf8'));
      if (prev.sourceSha256 === hash) {
        console.log(`skip (unchanged sha256): ${path.relative(ROOT, jsonAbs)} (${prev.posts?.length ?? 0} posts)`);
        process.exit(0);
      }
    } catch {
      /* rewrite */
    }
  }

  const posts = extractPosts(raw);
  const payload = {
    pubDate: opts.date,
    sourceHtml: dumpRel.split(path.sep).join('/'),
    sourceSha256: hash,
    extractedAt: new Date().toISOString(),
    postCount: posts.length,
    posts,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(jsonAbs, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await writeFile(mdAbs, renderPostsMd(opts.date, payload.sourceHtml, posts), 'utf8');

  const withText = posts.filter((p) => (p.text || '').length >= 20).length;
  const withMedia = posts.filter((p) => p.hasImage || p.hasVideo).length;
  console.log(`extracted ${posts.length} posts → ${path.relative(ROOT, outDir)}/`);
  console.log(`  text≥20: ${withText}  media: ${withMedia}`);
  console.log(`  ${path.relative(ROOT, jsonAbs)}`);
  console.log(`  ${path.relative(ROOT, mdAbs)}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
