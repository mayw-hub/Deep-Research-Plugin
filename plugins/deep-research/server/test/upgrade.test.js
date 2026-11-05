import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksBlocked, searchEuropePmc, fallbackText } from '../lib/europepmc.js';
import { compareMeta } from '../lib/verify.js';

test('blocked pages and fallback captions', () => {
  assert.equal(looksBlocked(403, ''), true);
  assert.equal(looksBlocked(200, 'Just a moment...'), true);
  assert.equal(looksBlocked(200, 'article '.repeat(400)), false);
  assert.match(fallbackText({ title: 'Title', id: '123' }, '<title>Figure 1</title><caption>Caption</caption>'), /Title[\s\S]*123[\s\S]*Figure 1\nCaption/);
});
test('metadata comparison checks supplied fields', () => {
  const record = { authorString: 'Garcia AB', pubYear: '2020', journalTitle: 'Journal of Tests' };
  assert.deepEqual(compareMeta({ authors: 'García AB', year: 2020, journal: 'Journal of Tests' }, record), []);
  assert.equal(compareMeta({ authors: 'Smith AB', year: 2021 }, record).length, 2);
  assert.deepEqual(compareMeta({}, record), []);
});
test('search requires a query or chase', async () => {
  await assert.rejects(searchEuropePmc({}, { getJson: async () => ({}) }), /Provide query, or pmid with direction/);
});
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { root, planSave, sourceAdd, sourceList, sourceScreen } from '../lib/state.js';
import { reportAssemble } from '../lib/assemble.js';
import { sourceVerify } from '../lib/verify.js';

test('state, screening, searches, verification and report appendices', async () => {
  const old = process.env.DEEP_RESEARCH_HOME;
  const dir = fs.mkdtempSync(path.resolve('node_modules/upgrade-test-'));
  try {
    process.env.DEEP_RESEARCH_HOME = dir;
    const { runId } = planSave({ question: 'Q', subquestions: ['a', 'b', 'c'], stop_criteria: 'done' });
    assert.ok(fs.existsSync(path.join(dir, runId, 'plan.json')));
    const base = { runId, url: 'https://example.com', title: 'Title', quote: 'Quote', claim: 'one', accessed: '2026-01-01' };
    sourceAdd({ ...base, pmid: '123', authors: 'García AB', year: 2020, journal: 'Journal', fulltext_read: false, status: 'excluded' });
    sourceAdd({ ...base, claim: 'two', doi: '10/a', authors: 'Smith AB' });
    sourceAdd({ ...base, claim: 'three', pmid: '456' });
    sourceAdd({ ...base, claim: 'four' });
    assert.equal(sourceList(runId)[0].status, 'included');
    assert.equal(sourceList(runId)[0].fulltext_read, false);
    assert.throws(() => sourceScreen({ runId, id: 99, decision: 'exclude', reason: 'x' }), /not found/);
    assert.equal(sourceScreen({ runId, id: 2, decision: 'exclude', reason: 'off-topic' }).status, 'excluded');
    assert.equal(sourceScreen({ runId, id: 2, decision: 'include', reason: 'relevant' }).status, 'included');
    sourceScreen({ runId, id: 2, decision: 'exclude', reason: 'off-topic' });
    let urls = [];
    const search = await searchEuropePmc({ runId, query: 'trial', from_year: 2020, to_year: 2022 }, { getJson: async url => { urls.push(url); return { hitCount: 1, resultList: { result: [{ id: '123', source: 'MED', title: 'Trial', authorString: 'Garcia AB', isOpenAccess: 'Y', abstractText: 'x'.repeat(1600) }] } }; } });
    assert.equal(new URL(urls[0]).searchParams.get('query'), 'trial AND (PUB_YEAR:[2020 TO 2022])');
    assert.equal(search.results[0].abstract.length, 1500);
    assert.equal(search.results[0].isOpenAccess, true);
    for (const direction of ['references', 'citedby']) await searchEuropePmc({ pmid: '123', direction }, { getJson: async url => { urls.push(url); return {}; } });
    assert.match(urls[1], /MED\/123\/references\?/); assert.match(urls[2], /MED\/123\/citations\?/);
    const verified = await sourceVerify({ runId }, { getJson: async url => {
      const q = new URL(url).searchParams.get('query');
      if (q.includes('456')) return { resultList: { result: [] } };
      return { resultList: { result: [{ authorString: q.includes('123') ? 'Garcia AB' : 'Other AB', pubYear: '2020', journalTitle: 'Journal' }] } };
    } });
    assert.deepEqual(verified.results.map(r => r.status), ['ok', 'mismatch', 'not_found', 'skipped']);
    assert.throws(() => reportAssemble({ runId, draft_markdown: '## Summary\n[1] [2] [3] [4]' }), /excluded source/);
    assert.throws(() => reportAssemble({ runId, draft_markdown: '## Summary\n[1] [3]' }), /source \[4\] is not cited/);
    assert.throws(() => reportAssemble({ runId, draft_markdown: '## Summary\n[1] [3] [4]\n## Search log\n[1]' }), /already contains/);
    const report = fs.readFileSync(reportAssemble({ runId, draft_markdown: '## Summary\n[1] [3] [4]' }).path, 'utf8');
    assert.match(report, /\[3\] Title/); assert.match(report, /abstract only/);
    assert.match(report, /## Excluded sources[\s\S]*\[2\] Title - off-topic/); assert.match(report, /## Search log/);
    delete process.env.DEEP_RESEARCH_HOME;
    assert.equal(root(), path.join(os.homedir(), 'Documents', 'DeepResearch'));
  } finally { if (old === undefined) delete process.env.DEEP_RESEARCH_HOME; else process.env.DEEP_RESEARCH_HOME = old; fs.rmSync(dir, { recursive: true, force: true }); }
});
