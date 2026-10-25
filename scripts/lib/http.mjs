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

export function extractHrefs(html, baseUrl) {
  const hrefs = [];
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      hrefs.push(new URL(m[1], baseUrl).href);
    } catch {
      // ignore bad URLs
    }
  }
  return hrefs;
}

export function pickHref(hrefs, { pattern, preferPattern, excludePattern, pick = 'first' } = {}) {
  let list = hrefs;
  if (pattern) {
    const re = new RegExp(pattern, 'i');
    list = list.filter((h) => re.test(h));
  }
  if (excludePattern) {
    const re = new RegExp(excludePattern, 'i');
    list = list.filter((h) => !re.test(h));
  }
  if (!list.length) return '';
  if (preferPattern) {
    const re = new RegExp(preferPattern, 'i');
    const preferred = list.filter((h) => re.test(h));
    if (preferred.length) list = preferred;
  }
  // de-dupe preserving order
  list = [...new Set(list)];
  return pick === 'last' ? list[list.length - 1] : list[0];
}
