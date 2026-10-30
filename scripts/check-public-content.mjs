#!/usr/bin/env node
/**
 * Heuristic scan of tracked files for content unfit for a public OSS repo.
 * Not a guarantee — human judgment still required before commit/PR.
 *
 * Intentional public content (広報 phones in posts, Threads embeds, empty
 * GA placeholders / Actions vars) is out of scope for these patterns.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SELF = path.relative(ROOT, import.meta.filename);

/** Files never scanned (known false-positive noise). */
const SKIP_FILES = new Set([
  'package-lock.json',
  'package-lock.yaml',
  'yarn.lock',
  'pnpm-lock.yaml',
  SELF.replaceAll('\\', '/'),
]);

/**
 * Maintainable pattern list. Keep ids stable; prefer specific over broad.
 * `allow` may suppress a hit (e.g. .gitignore ignore entries).
 */
const PATTERNS = [
  {
    id: 'personal-name',
    re: /\bKenta\b|健太|\bWatanabe\b|渡辺|kenta\.watanabe/u,
    hint: '個人名らしき文字列',
  },
  {
    id: 'home-path',
    re: /\/Users\/[A-Za-z0-9._-]+|\/home\/[a-z0-9._-]+/u,
    hint: 'ホームパスらしき文字列',
  },
  {
    id: 'private-email',
    re: /[a-z0-9._%+-]+@(?:liretech\.com|gmail\.com|yahoo\.co\.jp)/iu,
    hint: '非公開になりやすい個人／会社メール',
  },
  {
    id: 'local-helper-path',
    // Detect literal helper-dir path leaks without requiring docs to name them.
    re: /(^|[^a-zA-Z0-9_/.-])\.cursor\/|vault（|`\.cursor`|vault\/\.cursor/u,
    hint: 'ローカル専用パス／vault 言及',
    allow: (file, line) =>
      file === '.gitignore' && /^\s*\.cursor\/\s*$/.test(line),
  },
  {
    id: 'private-ops-ref',
    re: /Agent Store|Project Context|プロジェクト\s*Context|writing-style-kenta|layer-ownership/u,
    hint: '私的運用／非公開メモへの参照',
  },
  {
    id: 'secret-like',
    re: /\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9]{20,}|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY\b/u,
    hint: 'シークレットらしき文字列',
  },
];

function listTrackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return out.split('\0').filter(Boolean);
}

function isProbablyText(file, buf) {
  if (buf.includes(0)) return false;
  if (/\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|eot|zip|gz)$/i.test(file)) {
    return false;
  }
  return true;
}

const hits = [];

for (const file of listTrackedFiles()) {
  const norm = file.replaceAll('\\', '/');
  if (SKIP_FILES.has(norm)) continue;

  let buf;
  try {
    buf = await readFile(path.join(ROOT, file));
  } catch {
    continue;
  }
  if (!isProbablyText(file, buf)) continue;

  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const p of PATTERNS) {
      if (!p.re.test(line)) continue;
      // RegExp with /g keeps lastIndex; reset via test on fresh copy
      p.re.lastIndex = 0;
      if (p.allow?.(norm, line)) continue;
      hits.push({
        file: norm,
        line: i + 1,
        id: p.id,
        hint: p.hint,
        snippet: line.trim().slice(0, 160),
      });
    }
  }
}

if (hits.length === 0) {
  console.log('check:public-content: ok（ヒューリスティックヒットなし）');
  process.exit(0);
}

console.error(`check:public-content: ${hits.length} 件の要確認ヒット`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  [${h.id}] ${h.hint}`);
  console.error(`    ${h.snippet}`);
}
console.error(
  '意図的な公開コンテンツなら無視してよい。迷ったら追跡から外す（docs/quality.md）。',
);
process.exit(1);
