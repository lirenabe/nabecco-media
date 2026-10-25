const DEFAULT_UA =
  'nabecco-media-fetch/0.1 (+https://github.com/lirenabe/nabecco-media)';

export async function fetchText(url, { userAgent = DEFAULT_UA, timeoutMs = 45000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,*/*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return { url: res.url, text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBinary(url, { userAgent = DEFAULT_UA, timeoutMs = 45000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': userAgent, accept: 'application/pdf,*/*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { url: res.url, buf };
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @returns {{ href: string, text: string }[]} */
export function extractAnchors(html, baseUrl) {
  const anchors = [];
  const re = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      anchors.push({ href: new URL(m[1], baseUrl).href, text: stripTags(m[2]) });
    } catch {
      // ignore bad URLs
    }
  }
  return anchors;
}

export function extractHrefs(html, baseUrl) {
  return extractAnchors(html, baseUrl).map((a) => a.href);
}

/**
 * Pick a URL from href strings or {href,text} anchors.
 * Text filters (issueTextPattern / preferTextPattern) need anchors.
 */
export function pickHref(
  hrefsOrAnchors,
  {
    pattern,
    preferPattern,
    excludePattern,
    textPattern,
    preferTextPattern,
    excludeTextPattern,
    pick = 'first',
  } = {},
) {
  let list = (hrefsOrAnchors || []).map((x) =>
    typeof x === 'string' ? { href: x, text: '' } : { href: x.href, text: x.text || '' },
  );
  if (pattern) {
    const re = new RegExp(pattern, 'i');
    list = list.filter((a) => re.test(a.href));
  }
  if (textPattern) {
    const re = new RegExp(textPattern, 'i');
    list = list.filter((a) => re.test(a.text));
  }
  if (excludePattern) {
    const re = new RegExp(excludePattern, 'i');
    list = list.filter((a) => !re.test(a.href));
  }
  if (excludeTextPattern) {
    const re = new RegExp(excludeTextPattern, 'i');
    list = list.filter((a) => !re.test(a.text));
  }
  if (!list.length) return '';
  if (preferPattern) {
    const re = new RegExp(preferPattern, 'i');
    const preferred = list.filter((a) => re.test(a.href));
    if (preferred.length) list = preferred;
  }
  if (preferTextPattern) {
    const re = new RegExp(preferTextPattern, 'i');
    const preferred = list.filter((a) => re.test(a.text));
    if (preferred.length) list = preferred;
  }
  // de-dupe by href preserving order
  const seen = new Set();
  list = list.filter((a) => {
    if (seen.has(a.href)) return false;
    seen.add(a.href);
    return true;
  });
  return (pick === 'last' ? list[list.length - 1] : list[0]).href;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
