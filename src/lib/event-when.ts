/**
 * Best-effort parse of kouhou `events[].when` free text into ISO dates.
 * Does not invent dates — unparseable strings fall back to yearMonth filtering.
 */

export type ParsedEventWhen = {
  /** Earliest concrete day found (YYYY-MM-DD), if any */
  startDate?: string;
  /** Latest concrete day found (YYYY-MM-DD), if any */
  endDate?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toKey(y: number, m: number, d: number): string | undefined {
  if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return undefined;
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** 令和N年 → western calendar year (令和1 = 2019). */
function reiwaToWestern(n: number): number {
  return 2018 + n;
}

/**
 * Normalize 令和 and collect concrete calendar days from a when string.
 * Also resolves `〜11月10日` style tails using the preceding year.
 */
export function parseEventWhen(when: string, fallbackYearMonth?: string): ParsedEventWhen {
  const fallbackYear = fallbackYearMonth?.slice(0, 4);
  let lastYear = fallbackYear ? Number(fallbackYear) : undefined;

  let text = when.replace(/令和(\d+)年/gu, (_, n) => {
    const y = reiwaToWestern(Number(n));
    return `${y}年`;
  });

  const keys: string[] = [];

  const full = /(\d{4})年(\d{1,2})月(\d{1,2})日/gu;
  let m: RegExpExecArray | null;
  while ((m = full.exec(text)) !== null) {
    lastYear = Number(m[1]);
    const key = toKey(lastYear, Number(m[2]), Number(m[3]));
    if (key) keys.push(key);
  }

  // Range tails without year: 〜11月10日 / 〜2月1日（年またぎは開始月より小さい月→翌年）
  const tail = /[〜～](\d{1,2})月(\d{1,2})日/gu;
  while ((m = tail.exec(text)) !== null) {
    const idx = m.index ?? 0;
    const before = text.slice(Math.max(0, idx - 6), idx);
    if (/\d{4}年$/u.test(before)) continue;
    if (lastYear == null) continue;
    const month = Number(m[1]);
    const day = Number(m[2]);
    let year = lastYear;
    if (keys.length > 0) {
      const anchorMonth = Number(keys[keys.length - 1].slice(5, 7));
      if (month < anchorMonth) year = lastYear + 1;
    }
    const key = toKey(year, month, day);
    if (key) keys.push(key);
  }

  if (keys.length === 0) return {};
  const sorted = [...new Set(keys)].sort();
  const startDate = sorted[0];
  // "10月1日から" with no 〜 end → open-ended (no endDate)
  const openEnded = /から/u.test(when) && !/[〜～]/u.test(when);
  const endDate = openEnded ? undefined : sorted[sorted.length - 1];
  return { startDate, endDate };
}

/** Keep upcoming events; drop those whose latest concrete day is before today. */
export function isEventUpcoming(
  when: string,
  parsed: ParsedEventWhen,
  yearMonth: string,
  todayKey: string,
): boolean {
  if (parsed.endDate) return parsed.endDate >= todayKey;
  if (parsed.startDate) {
    // "10月1日から" with no end → still ongoing
    if (/から/u.test(when) && !/[〜～]/u.test(when)) return true;
    return parsed.startDate >= todayKey;
  }
  // Unparseable when → keep while the issue month is current or future
  return yearMonth >= todayKey.slice(0, 7);
}

export function eventSortKey(parsed: ParsedEventWhen, yearMonth: string, when: string): string {
  return parsed.startDate ?? `${yearMonth}-01` ?? when;
}
