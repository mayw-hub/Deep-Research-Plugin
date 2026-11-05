import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateUrl, forbiddenAddress } from '../lib/fetch.js';
import { planSave, sourceAdd, sourceList } from '../lib/state.js';
import { reportAssemble } from '../lib/assemble.js';

 test('refuses local and private addresses without network access', () => {
  for (const url of ['http://localhost', 'http://127.0.0.1', 'http://10.0.0.1', 'http://169.254.169.254', 'http://[::1]']) {
    assert.throws(() => validateUrl(url), /Refused/);
  }
  assert.equal(forbiddenAddress('::ffff:7f00:1'), true);
});

test('ledger IDs, duplicates, and report validation', () => {
  const original = process.env.DEEP_RESEARCH_HOME;
  const dir = fs.mkdtempSync(path.resolve('node_modules/deep-research-test-'));
  try {
    process.env.DEEP_RESEARCH_HOME = dir;
    const { runId } = planSave({ question: 'Question', subquestions: ['a', 'b', 'c'], stop_criteria: 'done' });
    const source = { runId, url: 'https://example.com/#fragment', title: 'Example', quote: 'Quote', claim: 'Claim', accessed: '2026-01-01' };
    assert.equal(sourceAdd(source).id, 1);
    assert.throws(() => sourceAdd({ ...source, url: 'https://example.com/' }), /Duplicate/);
    assert.equal(sourceAdd({ ...source, claim: 'Another claim' }).id, 2);
    assert.equal(sourceList(runId).length, 2);
    assert.throws(() => reportAssemble({ runId, draft_markdown: '## Summary\n[1] [2] [9]' }), /Citation \[9\]/);
    assert.throws(() => reportAssemble({ runId, draft_markdown: '## Summary\n[1]' }), /source \[2\] is not cited/);
    assert.throws(() => reportAssemble({ runId, draft_markdown: '## Summary\n[1] [2]\n## Gap\nNone' }), /Section "Gap" has no citation/);
    assert.throws(() => reportAssemble({ runId, draft_markdown: '## References\n[1] [2]' }), /already contains/);
    const result = reportAssemble({ runId, draft_markdown: '# Title\n## Summary\n[1] [2]\n## Limitations\nNone.' });
    assert.match(fs.readFileSync(result.path, 'utf8'), /## References\n\n\[1\] Example/);
  } finally { if (original === undefined) delete process.env.DEEP_RESEARCH_HOME; else process.env.DEEP_RESEARCH_HOME = original; fs.rmSync(dir, { recursive: true, force: true }); }
});

