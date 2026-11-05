import fs from 'node:fs';
import path from 'node:path';
import { runDir } from './state.js';
import { getJson as defaultGetJson, safeGet } from './fetch.js';

const base = 'https://www.ebi.ac.uk/europepmc/webservices/rest/';
export const looksBlocked = (status, text) => status === 403 || status === 429 || (text.length < 2000 && /captcha|just a moment|access denied|enable javascript|verify you are (a )?human|cookies must be enabled|enable cookies|cookies? (settings|policy|consent)/i.test(text));
export function searchUrl(query) {
  const url = new URL(base + 'search');
  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('resultType', 'core');
  return url;
}
export async function searchEuropePmc(params, { getJson = defaultGetJson } = {}) {
  const { runId, query, pmid, direction, from_year, to_year, page_size = 25, page = 1 } = params;
  if (!query && !(pmid && direction)) throw new Error('Provide query, or pmid with direction');
  if (runId) runDir(runId);
  let url;
  if (query) {
    const years = from_year != null || to_year != null ? ` AND (PUB_YEAR:[${from_year ?? 1900} TO ${to_year ?? new Date().getFullYear()}])` : '';
    url = searchUrl(query + years);
  } else {
    url = new URL(`${base}MED/${encodeURIComponent(pmid)}/${direction === 'references' ? 'references' : 'citations'}`);
    url.searchParams.set('format', 'json');
  }
  url.searchParams.set('pageSize', page_size); url.searchParams.set('page', page);
  const data = await getJson(url.href);
  const list = data.resultList?.result ?? data.referenceList?.reference ?? data.citationList?.citation ?? [];
  const results = list.map(r => ({ pmid: r.pmid ?? (r.source === 'MED' ? r.id : null), pmcid: r.pmcid ?? null, doi: r.doi ?? null, title: r.title ?? null, authors: r.authorString ?? null, journal: r.journalTitle ?? null, year: r.pubYear ?? null, pubType: r.pubTypeList?.pubType?.[0] ?? '', isOpenAccess: r.isOpenAccess == null ? null : r.isOpenAccess === 'Y', citedByCount: r.citedByCount ?? null, abstract: r.abstractText == null ? null : r.abstractText.slice(0, 1500) }));
  const hitCount = data.hitCount ?? 0;
  if (runId) fs.appendFileSync(path.join(runDir(runId), 'searches.jsonl'), JSON.stringify({ time: new Date().toISOString(), ...(query ? { query } : { pmid, direction }), from_year: from_year ?? null, to_year: to_year ?? null, hitCount, returned: results.length }) + '\n');
  return { hitCount, page, results };
}
export function fallbackText(record, xml = '') {
  const fields = [['Title', record.title], ['Authors', record.authorString], ['Journal', record.journalTitle], ['Year', record.pubYear], ['DOI', record.doi], ['PMID', record.pmid ?? record.id], ['PMCID', record.pmcid], ['pubType', record.pubTypeList?.pubType?.[0]], ['isOpenAccess', record.isOpenAccess], ['Abstract', record.abstractText]];
  let text = fields.filter(([, value]) => value != null).map(([label, value]) => `${label}: ${value}`).join('\n');
  if (xml) {
    const full = xml.replace(/<\/?(?:title|label|caption)(?:\s[^>]*)?>/gi, '\n').replace(/<[^>]*>/g, ' ').split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
    text += `\n\n## Full text (Europe PMC)\n\n${full}`;
  }
  return text;
}
export async function europePmcFallback(id, { getJson = defaultGetJson, getText = async url => (await safeGet(url)).text } = {}) {
  const query = /^PMC/i.test(id) ? `PMCID:${id.toUpperCase()}` : `EXT_ID:${id} AND SRC:MED`;
  const data = await getJson(searchUrl(query).href);
  const record = data.resultList?.result?.[0];
  if (!record) throw new Error('Europe PMC record not found');
  const xml = record.isOpenAccess === 'Y' && record.pmcid ? await getText(`${base}${encodeURIComponent(record.pmcid)}/fullTextXML`) : '';
  return fallbackText(record, xml);
}
