import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    vol: z.number(),
    description: z.string().optional(),
    /** true の間は本番ビルド（GitHub Pages）に出さない。公開時は false にするか削除。 */
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
