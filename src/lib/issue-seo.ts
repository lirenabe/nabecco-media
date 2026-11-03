/**
 * Reading-layer SEO helpers (no astro:content import — safe for Node checks).
 */

export type IssueSeoInput = {
  id: string;
  title: string;
  description: string;
  pubDate: Date;
  imagePath: string;
  /** Canonical path for this issue (`/` for latest, `/issues/vol-N/` otherwise). */
  pathname: string;
  /** When true, include バックナンバー breadcrumb (past issues only). */
  includeBackIssuesCrumb?: boolean;
};

function absoluteUrl(pathname: string, site: URL | undefined): string {
  if (!site) return pathname;
  return new URL(pathname, site).href;
}

export function issueArticleJsonLd(
  input: IssueSeoInput,
  site: URL | undefined,
): Record<string, unknown> {
  const pageUrl = absoluteUrl(input.pathname, site);
  const imageUrl = absoluteUrl(input.imagePath, site);
  const datePublished = input.pubDate.toISOString().slice(0, 10);

  const crumbs: { name: string; path: string }[] = [{ name: 'トップ', path: '/' }];
  if (input.includeBackIssuesCrumb) {
    crumbs.push({ name: 'バックナンバー', path: '/issues/' });
    crumbs.push({ name: input.title, path: input.pathname });
  }

  const graph: Record<string, unknown>[] = [];
  if (crumbs.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: absoluteUrl(c.path, site),
      })),
    });
  }

  graph.push({
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished,
    inLanguage: 'ja',
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    image: [imageUrl],
    author: { '@type': 'Organization', name: 'なべっこ' },
    publisher: {
      '@type': 'Organization',
      name: 'なべっこ',
      url: absoluteUrl('/', site),
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/logo.png', site),
      },
    },
  });

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}
