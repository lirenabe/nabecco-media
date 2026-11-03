/**
 * Remark: rewrite reading-layer 出典 blockquotes to
 *   [出典: …](公式URL) / [要約](/kouhou/…)
 *
 * Matches on content shape (`blockquote` + 「出典」+ http URL), not file path —
 * so local `astro dev` and GitHub Actions `astro build` behave the same.
 * 広報要約 Markdown uses list 出典, not these blockquotes, so it is untouched.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KOUHOU_DIR = path.join(ROOT, 'src/content/kouhou');
const MUNI_YAML = path.join(ROOT, 'sources/municipalities.yaml');
const SUMMARY_LABEL = '要約';

/** @type {{ names: string[], byName: Map<string, string>, available: Set<string> } | null} */
let cachedIndex = null;

function loadIndex() {
  if (cachedIndex) return cachedIndex;
  const doc = parseYaml(readFileSync(MUNI_YAML, 'utf8'));
  /** @type {Map<string, string>} */
  const byName = new Map();
  for (const s of doc.sources ?? []) {
    if (s?.name && s?.id) byName.set(String(s.name), String(s.id));
  }
  /** @type {Set<string>} */
  const available = new Set();
  for (const file of readdirSync(KOUHOU_DIR)) {
    const m = /^(.+)__(\d{4}-\d{2})\.md$/.exec(file);
    if (m) available.add(`${m[1]}|${m[2]}`);
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  cachedIndex = { names, byName, available };
  return cachedIndex;
}

function parseYearMonth(text) {
  const m = /(\d{4})年(\d{1,2})月/u.exec(text);
  if (!m) return null;
  return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}`;
}

function plainText(node) {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (!node.children) return '';
  return node.children.map(plainText).join('');
}

function walk(node, visit) {
  visit(node);
  if (!node.children) return;
  for (const child of node.children) walk(child, visit);
}

function findHttpUrl(node) {
  let found = null;
  walk(node, (n) => {
    if (found) return;
    if (n.type === 'link' && /^https?:\/\//i.test(n.url ?? '')) {
      found = n.url;
      return;
    }
    if (n.type === 'text') {
      const m = /https?:\/\/\S+/i.exec(n.value ?? '');
      if (m) found = m[0].replace(/[)、。.,;]+$/u, '');
    }
  });
  return found;
}

function citeLabelFrom(node) {
  return plainText(node)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function resolveSummaryHref(citeText, index) {
  const ym = parseYearMonth(citeText);
  if (!ym) return null;
  const name = index.names.find((n) => citeText.includes(n));
  if (!name) return null;
  const muniId = index.byName.get(name);
  if (!muniId || !index.available.has(`${muniId}|${ym}`)) return null;
  return `/kouhou/${muniId}/${ym}/`;
}

function alreadyRewritten(node) {
  const firstPara = node.children?.find((c) => c.type === 'paragraph');
  const firstLink = firstPara?.children?.find((c) => c.type === 'link');
  return Boolean(firstLink && plainText(firstLink).startsWith('出典'));
}

function linkNode(url, label, { newTab = false } = {}) {
  /** @type {Record<string, unknown>} */
  const node = {
    type: 'link',
    url,
    title: null,
    children: [{ type: 'text', value: label }],
  };
  if (newTab) {
    node.data = {
      hProperties: {
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    };
  }
  return node;
}

export function remarkKouhouCiteLinks() {
  const index = loadIndex();
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'blockquote') return;
      if (alreadyRewritten(node)) return;
      const label = citeLabelFrom(node);
      if (!label.includes('出典')) return;
      const officialUrl = findHttpUrl(node);
      if (!officialUrl) return;

      /** @type {import('mdast').PhrasingContent[]} */
      const children = [linkNode(officialUrl, label, { newTab: true })];
      const summaryHref = resolveSummaryHref(label, index);
      if (summaryHref) {
        children.push({ type: 'text', value: ' / ' });
        children.push(linkNode(summaryHref, SUMMARY_LABEL));
      }
      node.children = [{ type: 'paragraph', children }];
    });
  };
}
