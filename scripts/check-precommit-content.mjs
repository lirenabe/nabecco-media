#!/usr/bin/env node
/**
 * pre-commit（lint-staged）相当の静的チェックを、指定ファイルに対して実行する。
 * LLM は呼ばない。editorial self-review / ローカル確認用。
 *
 *   npm run check:precommit-content -- src/content/posts/vol-5.md
 *   npm run check:precommit-content -- --vol 5
 *   npm run check:precommit-content -- --vol 5 src/content/kouhou/town-happou__2026-12.md
 *
 * package.json lint-staged と同じコマンド群:
 *   - md/mdx → textlint
 *   - src/content/posts/*.md → check-citations / check-posts-privacy / check-threads-embeds
 * （css/astro の check:design は本スクリプトの対象外）
 */
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');

function usage() {
  console.log(`Usage:
  npm run check:precommit-content -- <path> [<path>...]
  npm run check:precommit-content -- --vol N [<extra path>...]

Mirrors lint-staged content hooks (textlint + post citation/privacy/embeds).`);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const files = [];
  let vol = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--vol') vol = argv[++i];
    else if (a === '-h' || a === '--help') return { help: true };
    else if (!a.startsWith('-')) files.push(a);
  }
  if (vol != null) files.unshift(path.join('src/content/posts', `vol-${vol}.md`));
  return { files, help: false };
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function isMarkdown(rel) {
  return /\.(md|mdx)$/i.test(rel);
}

function isPost(rel) {
  return /^src\/content\/posts\/[^/]+\.md$/i.test(rel.replace(/\\/g, '/'));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.files.length) {
    usage();
    process.exit(opts.help ? 0 : 1);
  }

  const absList = [];
  for (const f of opts.files) {
    const abs = path.resolve(ROOT, f);
    const rel = path.relative(ROOT, abs);
    if (!(await exists(abs))) {
      console.error(`Missing: ${rel}`);
      process.exit(1);
    }
    absList.push({ abs, rel: rel.replace(/\\/g, '/') });
  }

  console.log(`check:precommit-content (${absList.length} file(s))`);
  for (const { rel } of absList) console.log(`  - ${rel}`);

  let failed = 0;

  const mdFiles = absList.filter((x) => isMarkdown(x.rel)).map((x) => x.rel);
  if (mdFiles.length) {
    console.log('\n→ textlint');
    const textlintBin = path.join(ROOT, 'node_modules/textlint/bin/textlint.js');
    const code = await run(process.execPath, [
      textlintBin,
      '--ignore-path',
      '.textlintignore',
      ...mdFiles,
    ]);
    if (code !== 0) failed = code;
  }

  const posts = absList.filter((x) => isPost(x.rel)).map((x) => x.rel);
  if (posts.length) {
    // lint-staged と同じ: citations は全 posts 走査（argv なし）
    console.log('\n→ check-citations.mjs');
    {
      const code = await run(process.execPath, [
        path.join(ROOT, 'scripts/check-citations.mjs'),
      ]);
      if (code !== 0) failed = code;
    }
    for (const post of posts) {
      for (const script of [
        'scripts/check-posts-privacy.mjs',
        'scripts/check-threads-embeds.mjs',
      ]) {
        console.log(`\n→ ${path.basename(script)} ${post}`);
        const code = await run(process.execPath, [path.join(ROOT, script), post]);
        if (code !== 0) failed = code;
      }
    }
  }

  if (failed !== 0) {
    console.error('\ncheck:precommit-content: FAIL');
    process.exit(failed);
  }
  console.log('\ncheck:precommit-content: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
