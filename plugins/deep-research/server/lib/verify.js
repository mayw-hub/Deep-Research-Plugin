import { sourceList } from './state.js';
import { getJson as defaultGetJson } from './fetch.js';
import { searchUrl } from './europepmc.js';
const surname = value => (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[\s,]/)[0].toLowerCase();
const journal = value => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function compareMeta(entry, record) {
  const details = [];
  if (entry.authors && surname(entry.authors) !== surname(record.authorString)) details.push(`authors: ${entry.authors} vs ${record.authorString ?? ''}`);
  if (entry.year != null && String(entry.year) !== String(record.pubYear ?? '')) details.push(`year: ${entry.year} vs ${record.pubYear ?? ''}`);
  if (entry.journal) {
    const wanted = journal(entry.journal);
    const matches = [record.journalTitle, record.journalAbbreviation].some(value => { const actual = journal(value); return actual && (actual.includes(wanted) || wanted.includes(actual)); });
    if (!matches) details.push(`journal: ${entry.journal} vs ${record.journalTitle ?? ''} / ${record.journalAbbreviation ?? ''}`);
  }
  return details;
}
export async function sourceVerify({ runId }, { getJson = defaultGetJson } = {}) {
  const results = [];
  for (const entry of sourceList(runId)) {
    if (!entry.pmid && !entry.doi) { results.push({ id: entry.id, status: 'skipped', details: [] }); continue; }
    const query = entry.pmid ? `EXT_ID:${entry.pmid} AND SRC:MED` : `DOI:"${entry.doi}"`;
    const data = await getJson(searchUrl(query).href), record = data.resultList?.result?.[0];
    if (!record) { results.push({ id: entry.id, status: 'not_found', details: [] }); continue; }
    const details = compareMeta(entry, record);
    results.push({ id: entry.id, status: details.length ? 'mismatch' : 'ok', details });
  }
  return { checked: results.filter(result => result.status !== 'skipped').length, results };
}
