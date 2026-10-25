// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Custom domain on GitHub Pages — base stays '/'
  site: 'https://nabecco.media',

  integrations: [sitemap()]
});