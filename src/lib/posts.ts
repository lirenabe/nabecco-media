import { getCollection, type CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

/**
 * Production / preview builds omit draft posts.
 * `astro dev` includes them so confirmation work can be previewed locally.
 */
export function isPublishedPost(entry: PostEntry): boolean {
  return import.meta.env.DEV || entry.data.draft !== true;
}

export async function getPublishedPosts(): Promise<PostEntry[]> {
  return getCollection('posts', isPublishedPost);
}

/** Public feed / SEO: never include drafts, even under `astro dev`. */
export function isPublicPost(entry: PostEntry): boolean {
  return entry.data.draft !== true;
}

export async function getPublicPosts(): Promise<PostEntry[]> {
  return getCollection('posts', isPublicPost);
}

/** List / menu / page `<title>` / OG: topic text, with formal title as fallback. */
export function issueListLabel(data: { title: string; description?: string }): string {
  const topic = data.description?.trim();
  return topic || data.title;
}

/** Browser / OG title for an issue (same string as list / menu). */
export function issueShareTitle(data: { title: string; description?: string }): string {
  return issueListLabel(data);
}

/** RSS item title: topic plus pub date (for feeds / Threads where date is not shown separately). */
export function issueFeedTitle(data: {
  title: string;
  description?: string;
  pubDate: Date;
}): string {
  const topic = issueListLabel(data);
  const date = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(data.pubDate);
  return `${topic} — ${date}`;
}

export function sortPostsByDateDesc(posts: PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** Newest published post by pubDate, or undefined when none. */
export function getLatestPost(posts: PostEntry[]): PostEntry | undefined {
  return sortPostsByDateDesc(posts)[0];
}

/**
 * Permalink for menus / lists.
 * Latest published issue lives on `/` — its `/issues/vol-N/` URL redirects there.
 */
export function issueListHref(postId: string, latestId: string | undefined): string {
  return latestId && postId === latestId ? '/' : `/issues/${postId}/`;
}

/** First `![alt](src)` in Markdown body, if any. */
export function firstMarkdownImageSrc(body: string): string | undefined {
  const match = body.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  const src = match?.[1]?.trim();
  return src || undefined;
}

/**
 * Site-relative OG image path for an issue.
 * Prefer frontmatter `image`, else first body image (pickup), else `/og.png`.
 */
export function resolveIssueOgImage(
  data: { image?: string },
  body: string,
): string {
  const explicit = data.image?.trim();
  if (explicit) {
    return explicit.startsWith('/') ? explicit : `/${explicit}`;
  }
  const fromBody = firstMarkdownImageSrc(body);
  if (fromBody) {
    return fromBody.startsWith('/') ? fromBody : `/${fromBody}`;
  }
  return '/og.png';
}
