import fs from 'node:fs';
import path from 'node:path';
import { sourceList, writeReport, runDir } from './state.js';
export function validateDraft(draft, entries) {
  const problems = [];
  const cited = new Set([...draft.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1])));
  const ids = new Set(entries.map(entry => entry.id));
  for (const id of cited) if (!ids.has(id)) problems.push(`- Citation [${id}] has no ledger source.`);
  for (const entry of entries) {
    if (entry.status === 'excluded' && cited.has(entry.id)) problems.push(`- Citation [${entry.id}] refers to an excluded source.`);
    if (entry.status !== 'excluded' && !cited.has(entry.id)) problems.push(`- Ledger source [${entry.id}] is not cited.`);
  }
  const sections = [...draft.matchAll(/^##[ \t]+(.+?)[ \t]*\r?$/gm)];
  for (let i = 0; i < sections.length; i++) {
    const title = sections[i][1].trim();
    if (['References', 'Excluded sources', 'Search log'].includes(title)) problems.push(`- Draft already contains a ${title} section.`);
    else if (title !== 'Limitations') {
      const body = draft.slice(sections[i].index + sections[i][0].length, sections[i + 1]?.index ?? draft.length);
      if (!/\[\d+\]/.test(body)) problems.push(`- Section "${title}" has no citation.`);
    }
  }
  return problems;
}
export function reportAssemble({ runId, draft_markdown }) {
  const entries = sourceList(runId), problems = validateDraft(draft_markdown, entries);
  if (problems.length) throw new Error(problems.join('\n'));
  const refs = entries.filter(e => e.status !== 'excluded').map(e => {
    const parts = [e.authors ? `${e.authors}${e.year ? ` (${e.year})` : ''}` : e.year ? `(${e.year})` : '', e.title, e.journal, e.pmid ? `PMID: ${e.pmid}` : '', e.doi ? `DOI: ${e.doi}` : ''].filter(Boolean);
    return `[${e.id}] ${parts.join('. ')}. ${e.url} (accessed ${e.accessed}).${e.fulltext_read === false ? ' (abstract only)' : ''}`;
  }).join('\n');
  let report = `${draft_markdown.trimEnd()}\n\n## References\n\n${refs}`;
  const excluded = entries.filter(e => e.status === 'excluded');
  if (excluded.length) report += `\n\n## Excluded sources\n\n${excluded.map(e => `[${e.id}] ${e.title} - ${e.reason}`).join('\n')}`;
  const file = path.join(runDir(runId), 'searches.jsonl');
  if (fs.existsSync(file)) {
    const searches = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    if (searches.length) report += `\n\n## Search log\n\n${searches.map(s => `${s.time} | ${s.query ?? `${s.pmid} ${s.direction}`} | ${s.hitCount}`).join('\n')}`;
  }
  return { path: writeReport(runId, report + '\n') };
}
