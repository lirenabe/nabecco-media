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
