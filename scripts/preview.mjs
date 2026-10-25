import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASTRO = path.join(ROOT, 'node_modules/astro/bin/astro.mjs');

export function startPreview(port) {
  const child = spawn(
    process.execPath,
    [ASTRO, 'preview', '--host', '127.0.0.1', `--port`, String(port)],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let settled = false;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview timeout')), 60000);
    const onData = (buf) => {
      const s = buf.toString();
      process.stderr.write(s);
      if (!settled && new RegExp(String(port)).test(s)) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      if (settled) return;
      clearTimeout(timer);
      reject(new Error(`preview exited ${code}`));
    });
  });
  return { child, ready };
}
