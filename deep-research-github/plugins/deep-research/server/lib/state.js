import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

export const root = () => process.env.DEEP_RESEARCH_HOME || path.join(os.homedir(), 'Documents', 'DeepResearch');
export function runDir(runId) {
  if (!/^\d{8}-\d{6}-[0-9a-f]{4}$/.test(runId)) throw new Error('Invalid runId');
  const dir = path.join(root(), runId);
  if (!fs.existsSync(path.join(dir, 'plan.json'))) throw new Error('Run not found');
  return dir;
}
export function planSave({ question, subquestions, stop_criteria }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-');
  let runId, dir;
  do {
    runId = `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
    dir = path.join(root(), runId);
  } while (fs.existsSync(dir));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ question, subquestions, stop_criteria }, null, 2));
  fs.writeFileSync(path.join(dir, 'ledger.jsonl'), '');
  return { runId };
}
export function normalizeUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL must use http or https');
  url.hash = '';
  return url.href;
}
export function sourceList(runId) {
  const content = fs.readFileSync(path.join(runDir(runId), 'ledger.jsonl'), 'utf8');
  return content.split('\n').filter(Boolean).map(line => JSON.parse(line));
}
export function sourceAdd({ runId, url, title, quote, claim, accessed, ...optional }) {
  url = normalizeUrl(url);
  const entries = sourceList(runId);
  if (entries.some(entry => (entry.url === url || (optional.pmid && entry.pmid === optional.pmid)) && entry.claim === claim)) throw new Error('Duplicate URL and claim');
  const id = entries.length ? Math.max(...entries.map(entry => entry.id)) + 1 : 1;
  const fields = ['pmid', 'doi', 'authors', 'year', 'journal', 'design', 'n', 'population', 'intervention', 'outcomes', 'key_numbers', 'figures', 'evidence_level', 'fulltext_read'];
  const extra = Object.fromEntries(fields.filter(key => optional[key] !== undefined).map(key => [key, optional[key]]));
  fs.appendFileSync(path.join(runDir(runId), 'ledger.jsonl'), JSON.stringify({ id, url, title, quote, claim, accessed, ...extra, status: 'included' }) + '\n');
  return { id };
}
export function sourceScreen({ runId, id, decision, reason }) {
  const entries = sourceList(runId), entry = entries.find(item => item.id === id);
  if (!entry) throw new Error('Source not found');
  entry.status = decision === 'include' ? 'included' : 'excluded';
  entry.reason = reason;
  const file = path.join(runDir(runId), 'ledger.jsonl');
  const temp = file + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(temp, entries.map(item => JSON.stringify(item)).join('\n') + '\n');
  fs.renameSync(temp, file);
  return { id, status: entry.status };
}
export function writeReport(runId, text) {
  const file = path.join(runDir(runId), 'report.md');
  fs.writeFileSync(file, text);
  return file;
}
