/**
 * Reference-layer SEO helpers (no astro:content import — safe for Node checks).
 */

export type KouhouSeoIssue = {
  body?: string;
  data: {
    title: string;
    description: string;
    muniId: string;
    muniName: string;
    yearMonth: string;
    sourceUrl: string;
    generatedAt?: string;
  };
};

const META_DESCRIPTION_MAX = 155;

/** `2026-10` → `2026年10月号` */
export function yearMonthToJaIssue(yearMonth: string): string | undefined {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!m) return undefined;
  return `${m[1]}年${Number(m[2])}月号`;
}

/**
 * Bullets under `## この号の案内` (until the next `## ` heading).
 * Used to enrich `<meta description>` with searchable topic phrases.
 */
export function guideItemsFromBody(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+この号の案内\s*$/.test(line));
  if (start < 0) return [];
  const items: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^##\s+/.test(line)) break;
    const m = /^\s*-\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (text) items.push(text);
  }
  return items;
}

/**
 * Search-oriented meta description: leading 案内 bullets when present,
 * otherwise the frontmatter description (scaffold fallback).
 */
export function kouhouIssueMetaDescription(entry: KouhouSeoIssue): string {
  const label = yearMonthToJaIssue(entry.data.yearMonth) ?? entry.data.yearMonth;
  const prefix = `${entry.data.muniName}の広報${label}の要約。`;
  const items = guideItemsFromBody(entry.body ?? '');
  if (items.length === 0) {
    const fallback = entry.data.description?.trim();
    return fallback && fallback.length >= 10 ? fallback : prefix;
  }

  let desc = prefix;
  for (const item of items) {
    const next = desc === prefix ? `${desc}${item}` : `${desc}、${item}`;
    if (next.length > META_DESCRIPTION_MAX) break;
    desc = next;
  }
  if (desc.length > META_DESCRIPTION_MAX) {
    return `${desc.slice(0, META_DESCRIPTION_MAX - 1)}…`;
  }
  return desc;
}

/** Absolute site URL helper (falls back to path when `site` is unset). */
export function absoluteUrl(pathname: string, site: URL | undefined): string {
  if (!site) return pathname;
  return new URL(pathname, site).href;
}

function issueHref(entry: KouhouSeoIssue): string {
  return `/kouhou/${entry.data.muniId}/${entry.data.yearMonth}/`;
}

function muniHref(muniId: string): string {
  return `/kouhou/${muniId}/`;
}

export function kouhouIssueJsonLd(
  entry: KouhouSeoIssue,
  opts: { site: URL | undefined; description: string },
): Record<string, unknown> {
  const issuePath = issueHref(entry);
  const muniPath = muniHref(entry.data.muniId);
  const pageUrl = absoluteUrl(issuePath, opts.site);
  const issueLabel = yearMonthToJaIssue(entry.data.yearMonth) ?? entry.data.yearMonth;
  const crumbs = [
    { name: 'トップ', path: '/' },
    { name: '自治体の広報', path: '/kouhou/' },
    { name: entry.data.muniName, path: muniPath },
    { name: issueLabel, path: issuePath },
  ];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: absoluteUrl(c.path, opts.site),
        })),
      },
      {
        '@type': 'Article',
        headline: entry.data.title,
        description: opts.description,
        inLanguage: 'ja',
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        ...(entry.data.generatedAt ? { dateModified: entry.data.generatedAt } : {}),
        author: { '@type': 'Organization', name: 'なべっこ' },
        publisher: {
          '@type': 'Organization',
          name: 'なべっこ',
          url: absoluteUrl('/', opts.site),
        },
        isBasedOn: entry.data.sourceUrl,
        about: {
          '@type': 'AdministrativeArea',
          name: entry.data.muniName,
        },
      },
    ],
  };
}

export function municipalityJsonLd(opts: {
  site: URL | undefined;
  muniId: string;
  muniName: string;
  description: string;
  issues: KouhouSeoIssue[];
}): Record<string, unknown> {
  const muniPath = muniHref(opts.muniId);
  const pageUrl = absoluteUrl(muniPath, opts.site);
  const crumbs = [
    { name: 'トップ', path: '/' },
    { name: '自治体の広報', path: '/kouhou/' },
    { name: opts.muniName, path: muniPath },
  ];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: absoluteUrl(c.path, opts.site),
        })),
      },
      {
        '@type': 'CollectionPage',
        name: `${opts.muniName} 広報`,
        description: opts.description,
        url: pageUrl,
        inLanguage: 'ja',
        about: {
          '@type': 'AdministrativeArea',
          name: opts.muniName,
        },
        hasPart: opts.issues.slice(0, 24).map((issue) => ({
          '@type': 'Article',
          name: issue.data.title,
          url: absoluteUrl(issueHref(issue), opts.site),
        })),
      },
    ],
  };
}
