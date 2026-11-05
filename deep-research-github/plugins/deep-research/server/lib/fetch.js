import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import TurndownService from 'turndown';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { looksBlocked, europePmcFallback } from './europepmc.js';

export function forbiddenAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIP(address) === 6) {
    address = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    const parts = address.toLowerCase().split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    const words = [...left, ...Array(parts.length === 2 ? 8 - left.length - right.length : 0).fill('0'), ...right].map(x => parseInt(x, 16));
    if (words.slice(0, 5).every(x => x === 0) && words[5] === 0xffff) {
      return forbiddenAddress(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
    }
    return words.slice(0, 7).every(x => x === 0) && (words[7] === 0 || words[7] === 1) ||
      (words[0] & 0xfe00) === 0xfc00 || (words[0] & 0xffc0) === 0xfe80;
  }
  return true;
}
export function validateUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Refused: invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Refused: URL must use http or https');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (host === 'localhost' || ['.localhost', '.local', '.internal'].some(suffix => host.endsWith(suffix))) throw new Error('Refused: local hostname');
  if (net.isIP(host) && forbiddenAddress(host)) throw new Error('Refused: private or local address');
  return url;
}
export async function resolve(url, signal) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] :
    await Promise.race([dns.lookup(host, { all: true }), new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Fetch timed out')), { once: true }))]);
  if (!addresses.length || addresses.some(item => forbiddenAddress(item.address))) throw new Error('Refused: hostname resolves to a private or local address');
  return addresses[0];
}
export function request(url, address, signal) {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(url, {
      signal, headers: { 'User-Agent': 'deep-research-mcp/0.1' },
      lookup: (_host, options, callback) => options?.all
        ? callback(null, [{ address: address.address, family: address.family }])
        : callback(null, address.address, address.family)
    }, res => resolve(res));
    req.on('error', reject);
  });
}
export async function fetchPage({ url, max_chars = 20000 }) {
  const signal = AbortSignal.timeout(20000);
  let current = validateUrl(url), response;
  for (let redirects = 0; ; redirects++) {
    const address = await resolve(current, signal);
    response = await request(current, address, signal);
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      response.resume();
      if (redirects >= 5) throw new Error('Too many redirects');
      current = validateUrl(new URL(response.headers.location, current).href);
      continue;
    }
    break;
  }
  if ([403, 429].includes(response.statusCode)) { response.resume(); return blocked(current, response.statusCode, max_chars); }
  if (response.statusCode < 200 || response.statusCode >= 300) { response.resume(); throw new Error(`HTTP ${response.statusCode}`); }
  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > 10 * 1024 * 1024) { response.destroy(); throw new Error('Response exceeds 10MB'); }
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const content_type = response.headers['content-type'] || '';
  let text;
  if (/application\/pdf/i.test(content_type)) text = (await pdfParse(buffer)).text;
  else if (/text\/html|application\/xhtml\+xml/i.test(content_type)) {
    const converter = new TurndownService();
    converter.remove(['script', 'style', 'nav']);
    text = converter.turndown(buffer.toString('utf8'));
  } else text = buffer.toString('utf8');
  if (looksBlocked(response.statusCode, text)) return blocked(current, response.statusCode, max_chars);
  return { url: current.href, content_type, text: text.slice(0, max_chars), truncated: text.length > max_chars };
}
async function blocked(url, status, max_chars) {
  const host = url.hostname.toLowerCase();
  const id = host === 'pubmed.ncbi.nlm.nih.gov' ? url.pathname.match(/^\/(\d+)\/?/)?.[1] :
    ['www.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov'].includes(host) ? url.pathname.match(/(?:PMC\d+|(?<=\/)\d+(?=\/|$))/i)?.[0] : null;
  if (!id) throw new Error(`Blocked by site (HTTP ${status} or bot-check page); no fallback available for this host`);
  const text = await europePmcFallback(id);
  return { url: url.href, content_type: 'text/plain', text: text.slice(0, max_chars), truncated: text.length > max_chars, source: 'europepmc-fallback' };
}
export async function safeGet(value) {
  const signal = AbortSignal.timeout(20000);
  let url = validateUrl(value);
  for (let redirects = 0; ; redirects++) {
    const response = await request(url, await resolve(url, signal), signal);
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
      response.resume();
      if (redirects >= 5) throw new Error('Too many redirects');
      url = validateUrl(new URL(response.headers.location, url).href);
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) { response.resume(); throw new Error(`HTTP ${response.statusCode}`); }
    const chunks = []; let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > 10 * 1024 * 1024) { response.destroy(); throw new Error('Response exceeds 10MB'); }
      chunks.push(chunk);
    }
    return { text: Buffer.concat(chunks).toString('utf8'), status: response.statusCode };
  }
}
export async function getJson(url) {
  const { text, status } = await safeGet(url);
  try { return JSON.parse(text); } catch { throw new Error(`Non-JSON response (HTTP ${status})`); }
}
