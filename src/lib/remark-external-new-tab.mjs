/**
 * Remark: open absolute http(s) links in a new tab.
 * Applies to all Markdown (content shape only — no file-path gating),
 * so local and GitHub Actions builds match. Site-relative links are unchanged.
 */
function walk(node, visit) {
  visit(node);
  if (!node.children) return;
  for (const child of node.children) walk(child, visit);
}

export function remarkExternalNewTab() {
  return (tree) => {
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
