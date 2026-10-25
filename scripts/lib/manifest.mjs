/**
 * Durable fetch/extract manifest under data/kouhou/manifest.json.
 * Keyed by source id; values include url, sha256, optional etag/last-modified, path.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MANIFEST_REL = 'data/kouhou/manifest.json';

export function sha256Buffer(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export async function loadManifest(root) {
  const file = path.join(root, MANIFEST_REL);
  try {
    const doc = JSON.parse(await readFile(file, 'utf8'));
    if (!doc || typeof doc !== 'object') throw new Error('bad manifest');
    if (!doc.sources || typeof doc.sources !== 'object') doc.sources = {};
    return { file, doc };
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err instanceof SyntaxError)) {
      return {
        file,
        doc: { version: 1, updatedAt: null, sources: {} },
      };
    }
    throw err;
  }
}

export async function saveManifest(root, doc) {
  const file = path.join(root, MANIFEST_REL);
  await mkdir(path.dirname(file), { recursive: true });
  const next = {
    version: 1,
    updatedAt: new Date().toISOString(),
    sources: doc.sources || {},
  };
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return file;
}

export function getEntry(doc, id) {
  return doc.sources?.[id] || null;
}

export function setEntry(doc, id, entry) {
  if (!doc.sources) doc.sources = {};
  doc.sources[id] = { ...entry, id };
}

/** Stable on-disk PDF path (no date stamp — content identity lives in sha256). */
export function stablePdfRelPath(source) {
  return path.join('data/kouhou', `${source.code}_${source.id}.pdf`);
}

export function extractDirRel(id) {
  return path.join('data/kouhou/extracted', id);
}
