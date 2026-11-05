import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { planSave, sourceAdd, sourceList, sourceScreen } from './lib/state.js';
import { fetchPage } from './lib/fetch.js';
import { reportAssemble } from './lib/assemble.js';
import { searchEuropePmc } from './lib/europepmc.js';
import { sourceVerify } from './lib/verify.js';
const server = new McpServer({ name: 'deep-research', version: '0.2.0' });
const string = z.string();
const date = string.refine(s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s, 'Expected an ISO date');
function register(name, description, schema, fn) {
  server.registerTool(name, { description, inputSchema: schema }, async args => {
    try { return { content: [{ type: 'text', text: JSON.stringify(await fn(args)) }] }; }
    catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
  });
}
register('plan_save', 'Create a research plan.', { question: string, subquestions: z.array(string).min(3).max(8), stop_criteria: string }, planSave);
register('source_add', 'Add a source to the ledger.', { runId: string, url: string.url(), title: string, quote: string, claim: string, accessed: date, pmid: string.regex(/^\d+$/).optional(), doi: string.optional(), authors: string.optional(), year: z.number().int().min(1900).max(2100).optional(), journal: string.optional(), design: string.optional(), n: string.optional(), population: string.optional(), intervention: string.optional(), outcomes: string.optional(), key_numbers: string.optional(), figures: string.optional(), evidence_level: z.enum(['direct', 'indirect']).optional(), fulltext_read: z.boolean().optional() }, sourceAdd);
register('source_list', 'List ledger sources.', { runId: string }, ({ runId }) => sourceList(runId));
register('source_screen', 'Include or exclude a source.', { runId: string, id: z.number().int(), decision: z.enum(['include', 'exclude']), reason: string }, sourceScreen);
register('source_verify', 'Verify identifiers and metadata.', { runId: string }, sourceVerify);
register('literature_search', 'Search Europe PMC or chase citations.', { runId: string.optional(), query: string.optional(), pmid: string.regex(/^\d+$/).optional(), direction: z.enum(['references', 'citedby']).optional(), from_year: z.number().int().optional(), to_year: z.number().int().optional(), page_size: z.number().int().min(1).max(50).default(25), page: z.number().int().min(1).default(1) }, searchEuropePmc);
register('fetch_page', 'Fetch a public web page or PDF.', { url: string.url(), max_chars: z.number().int().positive().default(20000) }, fetchPage);
register('report_assemble', 'Validate and save a cited report.', { runId: string, draft_markdown: string }, reportAssemble);
await server.connect(new StdioServerTransport());
