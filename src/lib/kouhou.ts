import { getCollection, type CollectionEntry } from 'astro:content';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { eventSortKey, isEventUpcoming, parseEventWhen } from './event-when';
import { getPublishedPosts, type PostEntry } from './posts';

export type KouhouEntry = CollectionEntry<'kouhou'>;

export type MunicipalitySource = {
  id: string;
  name: string;
  listingUrl?: string;
  status?: string;
};

export async function loadMunicipalitySources(): Promise<MunicipalitySource[]> {
  const file = path.join(process.cwd(), 'sources/municipalities.yaml');
  const doc = parseYaml(await readFile(file, 'utf8')) as {
    sources?: MunicipalitySource[];
  };
  return doc.sources ?? [];
}

export async function getKouhouIssues(): Promise<KouhouEntry[]> {
  return getCollection('kouhou');
}

export function sortKouhouByMonthDesc(entries: KouhouEntry[]): KouhouEntry[] {
  return [...entries].sort((a, b) => b.data.yearMonth.localeCompare(a.data.yearMonth));
}

export function kouhouIssuesForMuni(entries: KouhouEntry[], muniId: string): KouhouEntry[] {
  return sortKouhouByMonthDesc(entries.filter((e) => e.data.muniId === muniId));
}

export function kouhouIssueHref(entry: KouhouEntry): string {
  return `/kouhou/${entry.data.muniId}/${entry.data.yearMonth}/`;
}

export function municipalityHref(muniId: string): string {
  return `/kouhou/${muniId}/`;
}

/** `2026-11` → `2026年11月` (no zero-pad on month; matches 出典 lines). */
export function yearMonthToJa(yearMonth: string): string | undefined {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!m) return undefined;
  return `${m[1]}年${Number(m[2])}月`;
}

/**
 * Reading-layer posts whose 出典 cites this 広報 issue (muni name + 年月).
 * Skips posts that only name the municipality without the issue month.
 */
export async function postsCitingKouhouIssue(entry: KouhouEntry): Promise<PostEntry[]> {
  const ymJa = yearMonthToJa(entry.data.yearMonth);
  if (!ymJa) return [];
  const muniName = entry.data.muniName;
  const posts = await getPublishedPosts();
  return posts.filter((p) => {
    const blob = `${p.data.description ?? ''}\n${p.body}`;
    const citeLines = blob.split('\n').filter((line) => line.includes('出典'));
    const haystacks = citeLines.length > 0 ? citeLines : [blob];
    return haystacks.some((h) => h.includes(muniName) && h.includes(ymJa));
  });
}

export type KouhouEvent = {
  when: string;
  what: string;
  where: string;
  contact: string;
  muniId: string;
  muniName: string;
  issueHref: string;
  yearMonth: string;
  sourceUrl: string;
  /** Best-effort ISO day from `when` (for sort / JSON-LD). */
  startDate?: string;
  endDate?: string;
};

export function collectEvents(entries: KouhouEntry[], today = new Date()): KouhouEvent[] {
  const todayKey = today.toISOString().slice(0, 10);
  const out: KouhouEvent[] = [];
  for (const entry of entries) {
    for (const ev of entry.data.events ?? []) {
      const parsed = parseEventWhen(ev.when, entry.data.yearMonth);
      if (!isEventUpcoming(ev.when, parsed, entry.data.yearMonth, todayKey)) continue;
      out.push({
        when: ev.when,
        what: ev.what,
        where: ev.where ?? '',
        contact: ev.contact ?? '',
        muniId: entry.data.muniId,
        muniName: entry.data.muniName,
        issueHref: kouhouIssueHref(entry),
        yearMonth: entry.data.yearMonth,
        sourceUrl: entry.data.sourceUrl,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      });
    }
  }
  return out.sort(
    (a, b) =>
      eventSortKey(
        { startDate: a.startDate, endDate: a.endDate },
        a.yearMonth,
        a.when,
      ).localeCompare(
        eventSortKey({ startDate: b.startDate, endDate: b.endDate }, b.yearMonth, b.when),
      ) ||
      a.muniName.localeCompare(b.muniName, 'ja') ||
      a.what.localeCompare(b.what, 'ja'),
  );
}
