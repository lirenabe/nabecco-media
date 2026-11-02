import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    /** 正式名（第N号 + 日付）。一覧・共有の主役は description。 */
    title: z.string(),
    pubDate: z.coerce.date(),
    vol: z.number(),
    /** トピック要約。`<title>` / OG / 一覧ラベルの主役。 */
    description: z.string().min(1),
    /** 任意の共有画像（サイト相対パス）。未指定なら本文先頭画像 → `/og.png`。 */
    image: z.string().optional(),
    /** true の間は本番ビルド（GitHub Pages）に出さない。公開時は false にするか削除。 */
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
