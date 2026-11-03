import { getCollection, type CollectionEntry } from 'astro:content';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
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

/** Reading-layer posts that mention this municipality (simple name match). */
export async function postsMentioningMunicipality(muniName: string): Promise<PostEntry[]> {
  const posts = await getPublishedPosts();
  const needle = muniName.replace(/(市|町|村|県)$/u, '');
  return posts.filter((p) => {
    const blob = `${p.data.title}\n${p.data.description}\n${p.body}`;
    return blob.includes(muniName) || (needle.length >= 2 && blob.includes(needle));
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
};

export function collectEvents(entries: KouhouEntry[], today = new Date()): KouhouEvent[] {
  const todayKey = today.toISOString().slice(0, 10);
  const out: KouhouEvent[] = [];
  for (const entry of entries) {
    for (const ev of entry.data.events ?? []) {
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
      });
    }
  }
  // Prefer sorting by yearMonth then when string; drop clearly past issue months.
  return out
    .filter((e) => e.yearMonth >= todayKey.slice(0, 7))
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth) || a.when.localeCompare(b.when));
}
