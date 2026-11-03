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

const kouhouEvent = z.object({
  when: z.string(),
  what: z.string(),
  where: z.string().default(''),
  contact: z.string().default(''),
});

/** Reference layer: mechanical summaries from Step B extracts (tracked outputs). */
const kouhou = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/kouhou' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    muniId: z.string(),
    muniName: z.string(),
    yearMonth: z.string(),
    issueNo: z.string().default(''),
    listingUrl: z.string(),
    sourceUrl: z.string(),
    sha256: z.string().default(''),
    generatedAt: z.string().optional(),
    /**
     * First time this muni+yearMonth page was scaffolded (new 広報 edition).
     * Used to list “新着の広報” on weekly issues after the previous vol’s pubDate.
     * Omitted on pages that existed before this field — those are not treated as new.
     */
    discoveredAt: z.string().optional(),
    events: z.array(kouhouEvent).default([]),
  }),
});

export const collections = { posts, kouhou };
