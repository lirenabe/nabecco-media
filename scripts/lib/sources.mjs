import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DEFAULT_PATH = path.join(ROOT, 'sources/municipalities.yaml');

export async function loadSources(file = DEFAULT_PATH) {
  const raw = await readFile(file, 'utf8');
  const doc = parseYaml(raw);
  if (!doc?.sources?.length) throw new Error(`No sources in ${file}`);
  const defaults = doc.defaults || {};
  return {
    version: doc.version,
    defaults,
    sources: doc.sources.map((s) => ({
      ...s,
      fetch: { ...(defaults.fetch || {}), ...(s.fetch || {}) },
    })),
    root: ROOT,
    file,
  };
}

export function sourceOutPath(root, outDir, source, pdfUrl) {
  const stamp = new Date().toISOString().slice(0, 10);
  let ext = '.pdf';
  try {
    const u = new URL(pdfUrl);
    const base = path.basename(u.pathname);
    if (/\.pdf$/i.test(base)) ext = '';
    const safe = `${source.code}_${source.id}_${stamp}_${base || 'latest.pdf'}`.replace(
      /[^\w.\-一-龥ぁ-んァ-ン]/gu,
      '_',
    );
    return path.join(root, outDir || 'data/kouhou', safe.endsWith('.pdf') ? safe : `${safe}.pdf`);
  } catch {
    return path.join(root, outDir || 'data/kouhou', `${source.code}_${source.id}_${stamp}.pdf`);
  }
}
