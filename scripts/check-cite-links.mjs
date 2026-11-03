#!/usr/bin/env node
/**
 * Guard: citation / external-link remark plugins must not depend on file paths.
 * Runs the same transforms CI/build use, against short fixtures.
 */
import { remarkKouhouCiteLinks } from '../src/lib/remark-cite-links.mjs';
import { remarkExternalNewTab } from '../src/lib/remark-external-new-tab.mjs';

function fail(msg) {
  console.error(`check:cite-links: ${msg}`);
  process.exit(1);
}

function plain(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  if (!node.children) return '';
  return node.children.map(plain).join('');
}

function citeTree() {
  return {
    type: 'root',
    children: [
      {
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', value: '出典: 三種町「広報みたね」2026年11月号 No.248' },
              { type: 'break' },
              {
                type: 'link',
                url: 'https://www.town.mitane.akita.jp/example',
                children: [{ type: 'text', value: 'https://www.town.mitane.akita.jp/example' }],
              },
            ],
          },
        ],
      },
    ],
  };
}

const cite = remarkKouhouCiteLinks();
const tree = citeTree();
cite(tree);

const para = tree.children[0]?.children?.[0];
const links = (para?.children ?? []).filter((n) => n.type === 'link');
if (links.length < 2) fail(`expected cite + 要約 links, got ${links.length}`);
if (!plain(links[0]).startsWith('出典:')) fail('first link should be the 出典 label');
if (links[0].url !== 'https://www.town.mitane.akita.jp/example') fail('出典 should point at official URL');
if (links[0].data?.hProperties?.target !== '_blank') fail('出典 should open in a new tab');
if (plain(links[1]) !== '要約') fail('second link should be 要約');
if (links[1].url !== '/kouhou/town-mitane/2026-11/') fail(`要約 href unexpected: ${links[1].url}`);

const noMonth = {
  type: 'root',
  children: [
    {
      type: 'blockquote',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: '出典: 八峰町広報（文化祭）' },
            { type: 'break' },
            {
              type: 'link',
              url: 'https://www.town.happo.lg.jp/x',
              children: [{ type: 'text', value: 'https://www.town.happo.lg.jp/x' }],
            },
          ],
        },
      ],
    },
  ],
};
cite(noMonth);
const noMonthLinks = (noMonth.children[0].children[0].children ?? []).filter((n) => n.type === 'link');
if (noMonthLinks.length !== 1) fail('month-less cite should be official link only');
if (plain(noMonthLinks[0]).includes('要約')) fail('month-less cite must not get 要約');

const ext = remarkExternalNewTab();
const kouhou = {
  type: 'root',
  children: [
    {
      type: 'paragraph',
      children: [
        {
          type: 'link',
          url: 'https://example.lg.jp/a.pdf',
          children: [{ type: 'text', value: '原本を開く' }],
        },
        { type: 'text', value: ' ' },
        {
          type: 'link',
          url: '/kouhou/town-mitane/',
          children: [{ type: 'text', value: '一覧' }],
        },
      ],
    },
  ],
};
ext(kouhou);
const [pdf, internal] = kouhou.children[0].children.filter((n) => n.type === 'link');
if (pdf.data?.hProperties?.target !== '_blank') fail('external PDF should be new tab');
if (internal.data?.hProperties?.target) fail('internal link must stay same tab');

console.log('check:cite-links: ok');
