#!/usr/bin/env node
/**
 * 文章の書き方チェック＆修正 — チェックリスト表示＋軽い禁則警告。
 * textlint とは別ループ。LLM は呼ばない。修正はオペレータ／エージェントが行う。
 *
 *   npm run prose-review -- --vol 2
 *   npm run prose-review -- src/content/posts/vol-2.md
 */
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { findMobileNumbers } from './lib/privacy-redact.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PROMPT_REL = 'scripts/prose-review-prompt.md';
const PROMPT_ABS = path.join(ROOT, PROMPT_REL);

/** 機械で拾える禁則っぽい断片（網羅しない。本チェックの主役はプロンプト） */
const BAN_SNIPPETS = [
  { re: /近いものから拾/g, note: '工程メタ' },
  { re: /優先して選びました/g, note: '工程メタ' },
  { re: /候補からまとめ/g, note: '工程メタ' },
  { re: /要約しました/g, note: '要約口調' },
  { re: /投稿があります/g, note: '要約口調' },
  { re: /試験下書き/g, note: '免責フッター' },
  { re: /要確認/g, note: '免責フッター' },
  { re: /同上/g, note: '出典省略' },
  { re: /前掲/g, note: '出典省略' },
];

const THEME_H3 = /^###\s*(フード|イベント|季節|暮らし|グルメ|観光)\b/gm;

function usage() {
  console.log(`Usage:
  npm run prose-review -- --vol N
  npm run prose-review -- src/content/posts/vol-N.md

Prompt: ${PROMPT_REL}
textlint のあと・公開前に、エージェント／人がチェックリストで直しを回す。`);
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const opts = { vol: null, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--vol') opts.vol = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (!a.startsWith('-')) opts.file = a;
  }
  return opts;
}

function scanBody(text) {
  const hits = [];
  for (const { re, note } of BAN_SNIPPETS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split('\n').length;
      hits.push({ line, note, match: m[0] });
    }
  }
  THEME_H3.lastIndex = 0;
  let m;
  while ((m = THEME_H3.exec(text)) !== null) {
    const line = text.slice(0, m.index).split('\n').length;
    hits.push({ line, note: 'テーマが h3（地域のみのはず）', match: m[0].trim() });
  }
  for (const { match, index } of findMobileNumbers(text)) {
    const line = text.slice(0, index).split('\n').length;
    hits.push({ line, note: '携帯電話番号（記事禁止）', match });
  }
  return hits;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    process.exit(0);
  }

  let targetRel = opts.file;
  if (opts.vol != null) {
    targetRel = path.join('src/content/posts', `vol-${opts.vol}.md`);
  }
  if (!targetRel) {
    usage();
    process.exit(1);
  }

  const targetAbs = path.resolve(ROOT, targetRel);
  const rel = path.relative(ROOT, targetAbs);

  console.log(`なべっこ 文章の書き方チェック＆修正
--------------------------------
対象     : ${rel}
チェックリスト: ${PROMPT_REL}
`);

  if (!(await fileExists(PROMPT_ABS))) {
    console.error(`Missing ${PROMPT_REL}`);
    process.exit(1);
  }

  if (!(await fileExists(targetAbs))) {
    console.error(`Article not found: ${rel}`);
    console.error('下書き後に再実行してください。');
    process.exit(1);
  }

  const text = await readFile(targetAbs, 'utf8');
  const hits = scanBody(text);

  if (hits.length) {
    console.log(`機械警告（参考・網羅しない）: ${hits.length} 件`);
    for (const h of hits) {
      console.log(`  L${h.line}: [${h.note}] ${h.match}`);
    }
    console.log('');
  } else {
    console.log('機械警告: なし（これで合格ではない — チェックリストを読め）\n');
  }

  console.log(`次の手順:
  1. ${PROMPT_REL} を開く
  2. ${rel} をチェックリスト A〜E で読む
  3. 落ちた項だけ直して保存
  4. npm run prose-review -- --vol … を再実行
  5. 人間レビュー → npm run check:fast → commit（自動公開しない）

任意: ローカル skill がある場合は語尾・へッジの細かい見本も重ねてよい（なくても完走可）。
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
