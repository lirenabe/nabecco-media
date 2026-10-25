#!/usr/bin/env node
/**
 * textlint over shared Markdown set (site content + non-site docs).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { listMarkdownPaths } from './markdown-paths.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const textlintBin = path.join(ROOT, 'node_modules/textlint/bin/textlint.js');
const files = await listMarkdownPaths();

if (!files.length) {
  console.error('No Markdown files found for textlint.');
  process.exit(1);
}

console.log(`textlint (${files.length} files):`);
for (const f of files) console.log(`  - ${f}`);

const child = spawn(process.execPath, [textlintBin, ...files], {
  cwd: ROOT,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
