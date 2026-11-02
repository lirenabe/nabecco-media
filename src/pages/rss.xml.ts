import rss from '@astrojs/rss';
import { getPublicPosts, issueFeedTitle, sortPostsByDateDesc } from '../lib/posts';

export async function GET(context: { site?: URL }) {
  const site = context.site;
  if (!site) {
    throw new Error('astro.config site is required for the RSS feed');
  }

  const posts = sortPostsByDateDesc(await getPublicPosts());

  return rss({
    title: 'なべっこ',
    description: '秋田県の公式広報と街の声を週ごとに要約する地域メディア、なべっこ。',
    site,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: [
      '<language>ja</language>',
      `<atom:link href="${new URL('rss.xml', site).href}" rel="self" type="application/rss+xml" />`,
    ].join(''),
    items: posts.map((post) => ({
      title: issueFeedTitle(post.data),
      description: post.data.description?.trim() || post.data.title,
      pubDate: post.data.pubDate,
      // Stable permalink; latest issue still redirects `/issues/vol-N/` → `/`.
      link: `/issues/${post.id}/`,
    })),
  });
}
