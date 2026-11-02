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

/** RSS / share line: topic (`description`) first when present. */
export function issueFeedTitle(data: {
  title: string;
  description?: string;
  vol: number;
}): string {
  const topic = data.description?.trim();
  return topic ? `${topic} — 第${data.vol}号` : data.title;
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
