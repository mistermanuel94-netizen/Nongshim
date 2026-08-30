import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ORIGIN = 'https://eng.nongshim.com';
export const CACHE_DIR = path.resolve('audit/.cache');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

let lastRequest = 0;
const MIN_GAP_MS = 200;

async function polite() {
  const wait = MIN_GAP_MS - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
}

const cacheKey = (url) => crypto.createHash('sha1').update(url).digest('hex') + '.json';

/**
 * Fetch a URL through an on-disk cache so repeated audit runs do not re-hit
 * the public site. Returns { url, status, headers, body, fromCache }.
 */
export async function get(url, { retries = 3, force = false } = {}) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, cacheKey(url));
  if (!force) {
    try {
      return { ...JSON.parse(await fs.readFile(file, 'utf8')), fromCache: true };
    } catch {}
  }

  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await polite();
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
      });
      const body = await res.text();
      const record = {
        url,
        finalUrl: res.url,
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body,
        fetchedAt: new Date().toISOString(),
      };
      await fs.writeFile(file, JSON.stringify(record));
      return { ...record, fromCache: false };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return { url, status: 0, headers: {}, body: '', error: String(lastErr), fetchedAt: new Date().toISOString() };
}

/** Fetch many URLs with bounded concurrency, preserving input order. */
export async function getAll(urls, { concurrency = 4, onProgress } = {}) {
  const results = new Array(urls.length);
  let cursor = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (cursor < urls.length) {
      const i = cursor++;
      results[i] = await get(urls[i]);
      onProgress?.(++done, urls.length, urls[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export const abs = (href, base = ORIGIN) => {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};
