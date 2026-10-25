#!/usr/bin/env node
/**
 * Generate a weekly issue Markdown draft from fetched 広報 PDFs (+ optional口コミ).
 * Never git-commits. Default output: data/drafts/vol-N.md
 *
 *   GEMINI_API_KEY=... npm run draft -- --vol 2 --date 2026-11-01
 *   npm run draft -- --vol 2 --date 2026-11-01 --dry-run
 *   npm run draft -- --vol 2 --date 2026-11-01 --apply
 *
 * --apply writes to src/content/posts/vol-N.md (still no commit; review first).
 */
import { mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadSources } from './lib/sources.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

function parseArgs(argv) {
  const opts = {
    vol: null,
    date: null,
    dryRun: false,
    apply: false,
    kuchikomi: path.join(ROOT, 'data/kuchikomi/example.txt'),
    pdfDir: path.join(ROOT, 'data/kouhou'),
    out: null,
    force: false,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--vol') opts.vol = Number(argv[++i]);
    else if (a === '--date') opts.date = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--apply') opts.apply = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--kuchikomi') opts.kuchikomi = path.resolve(argv[++i]);
    else if (a === '--pdf-dir') opts.pdfDir = path.resolve(argv[++i]);
    else if (a === '--out') opts.out = path.resolve(argv[++i]);
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function formatTitle(vol, dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid --date ${dateStr} (use YYYY-MM-DD)`);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `第${vol}号 ${y}年${m}月${day}日`;
}

async function listPdfs(dir) {
  try {
    const names = await readdir(dir);
    const out = [];
    for (const name of names) {
      if (!/\.pdf$/i.test(name)) continue;
      const abs = path.join(dir, name);
      const st = await stat(abs);
      if (st.isFile() && st.size > 0) out.push({ name, abs, size: st.size });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function readKuchikomi(file) {
  try {
    return (await readFile(file, 'utf8')).trim();
  } catch {
    return '';
  }
}

function mockDraft({ title, pubDate, vol, pdfs, kuchikomi, sources }) {
  const citeLines = pdfs.map((p) => {
    const id = p.name.split('_')[1] || p.name;
    const src = sources.find((s) => s.id === id);
    const label = src ? src.name : id;
    const url = src?.listingUrl || '';
    return `- ${label}の広報紙（ローカル: \`${p.name}\`）${url ? `\n  > 出典: ${url}` : ''}`;
  });

  const kuchikomiBlock = kuchikomi
    ? `口コミ入力あり（${kuchikomi.split('\n').length} 行）。公開前に事実確認すること。`
    : '口コミ入力なし（`data/kuchikomi/` にテキストを置ける）。';

  return `---
title: ${title}
pubDate: ${pubDate}
vol: ${vol}
description: 秋田県内の広報紙と街の声の週次要約（下書き・要人間確認）
---

## ピックアップ

（下書き / dry-run）取得済み広報 PDF ${pdfs.length} 件を要約予定。
イベント・新施設・講座など住民の行動に効く話題を優先し、行政手続きの定例案内は載せない。

${citeLines[0] || '> 出典: （PDF 未取得。先に npm run fetch:kouhou）'}

## 直近のイベント情報

（下書き / dry-run）各号 PDF から開催日・場所・申込の要点を箇条書きでまとめる。
丸写し禁止。固有名詞と日時は人間が突き合わせる。

${citeLines.slice(0, 3).join('\n\n') || '> 出典: （未取得）'}

## 今週のあきた

（下書き / dry-run）県＋市町村の動きを横断して短く。${kuchikomiBlock}

${citeLines.join('\n\n') || '> 出典: （未取得）'}
`;
}

function buildPrompt({ title, pubDate, vol, kuchikomi, pdfMeta }) {
  return `あなたは秋田県の週刊地域メディア「なべっこ」の編集アシスタントです。
添付の自治体広報紙 PDF（と口コミメモ）だけを根拠に、日本語 Markdown 記事の下書きを書いてください。

# 厳守
- 広報の丸写し禁止。客観的な要約・リライトのみ
- 載せる: イベント、祭り、新施設、体験講座、店舗・生活の変化
- 載せない: 税金・年金・議会報告など定例行政手続きの詳細（必要なら公式への一言案内のみ）
- 各セクションに出典を付ける（広報の自治体名・号が分かれば記載。URL があれば \`> 出典: URL\`）
- 本文に H1（#）を置かない。次の H2 だけを使うこと
- Frontmatter は次の YAML をそのまま先頭に置く（値は指定どおり）

---
title: ${title}
pubDate: ${pubDate}
vol: ${vol}
description: 秋田県内の広報紙と街の声の週次要約（下書き・要人間確認）
---

## ピックアップ

## 直近のイベント情報

## 今週のあきた

# 入力メタ
- 号: ${title}
- PDF 一覧: ${pdfMeta}
- 口コミメモ:
${kuchikomi || '（なし）'}
`;
}

async function draftWithGemini({ apiKey, model, prompt, pdfs }) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const gm = genAI.getGenerativeModel({ model });

  const parts = [{ text: prompt }];
  // Attach up to 4 PDFs to stay within practical request size.
  for (const pdf of pdfs.slice(0, 4)) {
    const data = await readFile(pdf.abs);
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: data.toString('base64'),
      },
    });
    parts.push({ text: `（添付 PDF: ${pdf.name} / ${pdf.size} bytes）` });
  }

  const result = await gm.generateContent({ contents: [{ role: 'user', parts }] });
  const text = result.response.text();
  if (!text?.trim()) throw new Error('empty Gemini response');
  return text.trim() + '\n';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(`Usage: node scripts/draft-issue.mjs --vol N --date YYYY-MM-DD [--dry-run] [--apply] [--force]`);
    process.exit(0);
  }
  if (!opts.vol || !opts.date) {
    console.error('Required: --vol <n> --date YYYY-MM-DD');
    process.exit(1);
  }

  const title = formatTitle(opts.vol, opts.date);
  const { sources } = await loadSources();
  const pdfs = await listPdfs(opts.pdfDir);
  const kuchikomi = await readKuchikomi(opts.kuchikomi);
  const apiKey = process.env.GEMINI_API_KEY || '';
  const useMock = opts.dryRun || !apiKey;

  if (!apiKey && !opts.dryRun) {
    console.warn('GEMINI_API_KEY unset — running dry-run/mock draft. Set the key for live multimodal generation.');
  }
  if (!pdfs.length) {
    console.warn(`No PDFs in ${opts.pdfDir}. Run: npm run fetch:kouhou`);
  }

  let markdown;
  if (useMock) {
    markdown = mockDraft({
      title,
      pubDate: opts.date,
      vol: opts.vol,
      pdfs,
      kuchikomi,
      sources,
    });
    console.log(useMock && apiKey ? 'Mode: --dry-run (mock body)' : 'Mode: mock (no GEMINI_API_KEY)');
  } else {
    console.log(`Mode: Gemini (${opts.model}), attaching ${Math.min(pdfs.length, 4)} PDF(s)`);
    const prompt = buildPrompt({
      title,
      pubDate: opts.date,
      vol: opts.vol,
      kuchikomi,
      pdfMeta: pdfs.map((p) => p.name).join(', ') || '（なし）',
    });
    markdown = await draftWithGemini({ apiKey, model: opts.model, prompt, pdfs });
    if (!/^---\n/.test(markdown)) {
      markdown = `---\ntitle: ${title}\npubDate: ${opts.date}\nvol: ${opts.vol}\n---\n\n${markdown}`;
    }
  }

  const defaultOut = opts.apply
    ? path.join(ROOT, 'src/content/posts', `vol-${opts.vol}.md`)
    : path.join(ROOT, 'data/drafts', `vol-${opts.vol}.md`);
  const outPath = opts.out || defaultOut;

  try {
    await stat(outPath);
    if (!opts.force) {
      console.error(`Refusing to overwrite ${path.relative(ROOT, outPath)} (pass --force)`);
      process.exit(1);
    }
  } catch {
    // not exists — ok
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
  console.log('Next: review the draft (POLICY.md), then commit manually. Never auto-publish.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
