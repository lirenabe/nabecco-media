import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkKouhouCiteLinks } from './remark-cite-links.mjs';
import { remarkExternalNewTab } from './remark-external-new-tab.mjs';

const EVENTS_HEADING = /^## 直近のイベント情報\s*$/m;

type Processor = Awaited<ReturnType<typeof createMarkdownProcessor>>;
let processorPromise: Promise<Processor> | undefined;

function getProcessor() {
  if (!processorPromise) {
    processorPromise = createMarkdownProcessor({
      remarkPlugins: [remarkKouhouCiteLinks, remarkExternalNewTab],
    });
  }
  return processorPromise;
}

/** Split weekly issue body so「新着の広報」can sit just before 直近のイベント情報. */
export function splitPostBodyAroundEvents(body: string): {
  before: string;
  after: string;
  hasEventsHeading: boolean;
} {
  const match = EVENTS_HEADING.exec(body);
  if (!match || match.index === undefined) {
    return { before: body, after: '', hasEventsHeading: false };
  }
  return {
    before: body.slice(0, match.index).replace(/\s+$/u, ''),
    after: body.slice(match.index),
    hasEventsHeading: true,
  };
}

export async function renderPostMarkdown(body: string): Promise<string> {
  if (!body.trim()) return '';
  const processor = await getProcessor();
  const result = await processor.render(body);
  return result.code;
}
