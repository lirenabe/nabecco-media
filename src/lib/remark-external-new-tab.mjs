/**
 * Remark: open absolute http(s) links in a new tab.
 * Used for 広報要約 pages (公式案内・PDF). Internal paths are unchanged.
 */
function walk(node, visit) {
  visit(node);
  if (!node.children) return;
  for (const child of node.children) walk(child, visit);
}

function isKouhouFile(file) {
  const p = String(file.path ?? file.history?.[0] ?? '').replace(/\\/g, '/');
  return p.includes('/content/kouhou/') || p.includes('/src/content/kouhou/');
}

export function remarkExternalNewTab() {
  return (tree, file) => {
    if (!isKouhouFile(file)) return;
    walk(tree, (node) => {
      if (node.type !== 'link') return;
      if (!/^https?:\/\//i.test(node.url ?? '')) return;
      const prev = node.data?.hProperties ?? {};
      node.data = {
        ...node.data,
        hProperties: {
          ...prev,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      };
    });
  };
}
