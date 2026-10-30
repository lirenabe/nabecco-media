// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { latestPublishedPostId } from './scripts/lib/latest-published.mjs';

const latestId = latestPublishedPostId();
const latestIssueUrl = latestId ? `https://nabecco.media/issues/${latestId}/` : null;

// https://astro.build/config
export default defineConfig({
  // Custom domain on GitHub Pages — base stays '/'
  site: 'https://nabecco.media',

  integrations: [
    sitemap({
      // Latest issue body is at `/`; `/issues/vol-N/` is a noindex redirect page.
      filter: (page) => !(latestIssueUrl && page === latestIssueUrl),
      serialize(item) {
        if (latestIssueUrl && item.url === latestIssueUrl) return undefined;
        return item;
      },
    }),
  ],
});
