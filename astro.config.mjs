// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { latestPublishedPostId } from './scripts/lib/latest-published.mjs';
import { buildSitemapLastmodMap } from './scripts/lib/sitemap-lastmod.mjs';
import { remarkKouhouCiteLinks } from './src/lib/remark-cite-links.mjs';
import { remarkExternalNewTab } from './src/lib/remark-external-new-tab.mjs';

const site = 'https://nabecco.media';
const latestId = latestPublishedPostId();
const latestIssueUrl = latestId ? `${site}/issues/${latestId}/` : null;
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
      // Latest issue body is at `/`; `/issues/vol-N/` is a noindex redirect page.
      filter: (page) => !(latestIssueUrl && page === latestIssueUrl),
      serialize(item) {
        if (latestIssueUrl && item.url === latestIssueUrl) return undefined;
        const lastmod = lastmodByUrl.get(item.url);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
});
