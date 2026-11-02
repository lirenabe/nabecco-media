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

/**
 * Browser / OG title for an issue: topic (`description`) first, 第N号 as suffix.
 * Formal frontmatter `title` (第N号 + date) stays for archival labeling.
 */
export function issueShareTitle(data: { description: string; vol: number }): string {
  return `${data.description} — 第${data.vol}号`;
}

/** List / menu label: topic text, with formal title as fallback. */
export function issueListLabel(data: { title: string; description?: string }): string {
  const topic = data.description?.trim();
  return topic || data.title;
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
