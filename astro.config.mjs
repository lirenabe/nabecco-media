// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { buildSitemapLastmodMap } from './scripts/lib/sitemap-lastmod.mjs';
import { remarkKouhouCiteLinks } from './src/lib/remark-cite-links.mjs';
import { remarkExternalNewTab } from './src/lib/remark-external-new-tab.mjs';

const site = 'https://nabecco.media';
const lastmodByUrl = buildSitemapLastmodMap(process.cwd(), site);

// https://astro.build/config
export default defineConfig({
  // Custom domain on GitHub Pages — base stays '/'
  site,

  markdown: {
    // unified: needed for remark plugins (Sätteri default has none).
    processor: unified({
      remarkPlugins: [remarkKouhouCiteLinks, remarkExternalNewTab],
    }),
  },

  integrations: [
    sitemap({
      // `/` mirrors the latest issue; permanent URL is `/issues/vol-N/` (both indexed;
      // homepage canonical points at the issue permalink).
      serialize(item) {
        const lastmod = lastmodByUrl.get(item.url);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
});
