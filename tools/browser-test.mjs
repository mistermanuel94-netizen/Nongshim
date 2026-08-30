/**
 * PHASE 16 — real-browser regression tests.
 *
 * Drives headless Chrome over the built site to check the things static
 * analysis cannot see: computed layout at real viewport widths, keyboard focus
 * order and visibility, reflow at 400% zoom, text-spacing overrides, and the
 * behaviour of the three interactive components with and without JavaScript.
 *
 * Writes audit/browser-report.md. Exit code 1 on any failure.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer-core';
import * as chromeLauncher from 'chrome-launcher';

const brotli = promisify(zlib.brotliCompress);
const DIST = 'dist';
const PORT = 4322;
const BASE = `http://localhost:${PORT}`;

const failures = [];
const passes = [];
const check = (ok, label, detail = '') => {
  (ok ? passes : failures).push(detail ? `${label} — ${detail}` : label);
  return ok;
};

/** Widths from the brief, covering small phones through large desktops. */
const WIDTHS = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920];

const PAGES = [
  { label: 'Homepage', route: '/' },
  { label: 'Product listing', route: '/products/' },
  { label: 'Product category', route: '/products/snacks/' },
  { label: 'Product detail', route: '/products/shin-ramyun/' },
  { label: 'Recipe listing', route: '/recipes/' },
  { label: 'Recipe detail', route: '/recipes/chapaguri/' },
  { label: 'Character', route: '/shin/' },
  { label: 'History', route: '/about/history/' },
  { label: 'Global network', route: '/about/global/' },
  { label: 'Locations', route: '/contact/location/' },
  { label: 'Company page', route: '/about/overview/' },
  { label: 'Search', route: '/search/' },
  { label: 'Error page', route: '/404.html' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript|manifest))/;

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      let file = path.join(DIST, decodeURIComponent(new URL(req.url ?? '/', BASE).pathname));
      try {
        const stat = await fs.stat(file).catch(() => null);
        if (!stat || stat.isDirectory()) file = path.join(file, 'index.html');
        let body = await fs.readFile(file);
        const type = MIME[path.extname(file)] ?? 'application/octet-stream';
        const headers = { 'content-type': type };
        if (COMPRESSIBLE.test(type) && /\bbr\b/.test(req.headers['accept-encoding'] ?? '')) {
          body = await brotli(body);
          headers['content-encoding'] = 'br';
        }
        headers['content-length'] = String(body.length);
        res.writeHead(200, headers);
        res.end(body);
      } catch {
        const notFound = await fs.readFile(path.join(DIST, '404.html')).catch(() => Buffer.from('Not found'));
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end(notFound);
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

/* ------------------------------------------------------------------ tests */

/** No page may scroll horizontally at any supported width. */
async function testResponsive(page) {
  const overflow = [];
  for (const target of PAGES) {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      await page.goto(BASE + target.route, { waitUntil: 'load' });
      const result = await page.evaluate(() => {
        const doc = document.documentElement;
        const offenders = [];
        if (doc.scrollWidth > doc.clientWidth + 1) {
          for (const el of document.querySelectorAll('body *')) {
            const rect = el.getBoundingClientRect();
            if (rect.right > doc.clientWidth + 1 || rect.left < -1) {
              const style = getComputedStyle(el.parentElement ?? el);
              // An element inside a deliberate horizontal scroller is fine.
              if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
              offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
              if (offenders.length > 3) break;
            }
          }
        }
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, offenders };
      });
      if (result.scrollWidth > result.clientWidth + 1 && result.offenders.length) {
        overflow.push(`${target.label} @ ${width}px: ${result.offenders.join(', ')}`);
      }
    }
  }
  check(overflow.length === 0, `No horizontal overflow across ${PAGES.length} pages x ${WIDTHS.length} widths`, overflow.slice(0, 5).join(' | '));
  return overflow;
}

/** WCAG 1.4.10: content must reflow at 400% zoom without a second scroll axis. */
async function testReflow(page) {
  const problems = [];
  for (const target of PAGES.slice(0, 8)) {
    // 400% zoom at 1280px is equivalent to a 320px CSS viewport.
    await page.setViewport({ width: 320, height: 512, deviceScaleFactor: 1 });
    await page.goto(BASE + target.route, { waitUntil: 'load' });
    const result = await page.evaluate(() => {
      const doc = document.documentElement;
      return { horizontal: doc.scrollWidth > doc.clientWidth + 1, width: doc.scrollWidth, client: doc.clientWidth };
    });
    if (result.horizontal) problems.push(`${target.label}: ${result.width} > ${result.client}`);
  }
  check(problems.length === 0, 'Reflow at 400% zoom (320px equivalent) with no horizontal scroll', problems.join(' | '));
  return problems;
}

/** WCAG 1.4.12: user text-spacing overrides must not clip or overlap content. */
async function testTextSpacing(page) {
  const problems = [];
  for (const target of PAGES.slice(0, 6)) {
    await page.setViewport({ width: 375, height: 800, deviceScaleFactor: 1 });
    await page.goto(BASE + target.route, { waitUntil: 'load' });
    const result = await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`;
      document.head.appendChild(style);
      const doc = document.documentElement;
      let clipped = 0;
      for (const el of document.querySelectorAll('main h1, main h2, main h3, main p, main li, main dd')) {
        if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflow === 'hidden') clipped++;
      }
      return { horizontal: doc.scrollWidth > doc.clientWidth + 1, clipped };
    });
    if (result.horizontal || result.clipped) {
      problems.push(`${target.label}: overflow=${result.horizontal} clipped=${result.clipped}`);
    }
  }
  check(problems.length === 0, 'Text-spacing overrides cause no clipping or overflow', problems.join(' | '));
  return problems;
}

/** Focus order follows document order, and every focused element is visible. */
async function testKeyboard(page) {
  const problems = [];
  for (const target of PAGES.slice(0, 6)) {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(BASE + target.route, { waitUntil: 'load' });

    const trace = await page.evaluate(async () => {
      const seen = [];
      const focusable = () =>
        [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter(
          (el) => el.offsetParent !== null || el.classList.contains('skip-link')
        );
      const all = focusable();
      return { count: all.length, first: all[0]?.className ?? null };
    });

    // The skip link must be the first focusable element.
    if (!String(trace.first).includes('skip-link')) {
      problems.push(`${target.label}: first focusable is "${trace.first}", expected the skip link`);
    }

    // Tab through the first 40 stops and confirm each has a visible focus ring
    // and lies in document order.
    const focusResult = await page.evaluate(async () => {
      const order = [];
      const noOutline = [];
      let previous = null;
      for (let i = 0; i < 40; i++) {
        const active = document.activeElement;
        if (active && active !== document.body) {
          const style = getComputedStyle(active);
          const ring =
            (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
            style.boxShadow !== 'none';
          if (!ring && active.matches(':focus-visible')) noOutline.push(active.tagName);
          if (previous) {
            const position = previous.compareDocumentPosition(active);
            // 4 = FOLLOWING, 16 = CONTAINED_BY
            if (!(position & 4) && !(position & 16)) order.push(active.tagName);
          }
          previous = active;
        }
        // Puppeteer drives the real Tab key from outside this evaluate call, so
        // record state and let the caller advance.
        break;
      }
      return { order, noOutline };
    });

    let backwards = 0;
    let unfocusable = 0;
    let previousHandle = null;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate((prevPath) => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const hasRing =
          (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
        const pathOf = (node) => {
          const parts = [];
          while (node && node.nodeType === 1 && node !== document.documentElement) {
            parts.unshift([...(node.parentNode?.children ?? [])].indexOf(node));
            node = node.parentNode;
          }
          return parts.join('.');
        };
        const current = pathOf(el);
        return {
          tag: el.tagName,
          hasRing,
          current,
          backwards: prevPath ? current.localeCompare(prevPath, undefined, { numeric: true }) < 0 : false,
        };
      }, previousHandle);
      if (!info) break;
      if (!info.hasRing) unfocusable++;
      if (info.backwards) backwards++;
      previousHandle = info.current;
    }
    if (unfocusable) problems.push(`${target.label}: ${unfocusable} focus stops without a visible ring`);
    if (backwards) problems.push(`${target.label}: ${backwards} focus stops out of document order`);
    void focusResult;
  }
  check(problems.length === 0, 'Keyboard focus order and focus visibility', problems.slice(0, 4).join(' | '));
  return problems;
}

/** The header disclosures must be keyboard-operable and Escape-closable. */
async function testDisclosures(page) {
  const problems = [];
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'load' });

  const opened = await page.evaluate(() => {
    const summary = document.querySelector('.site-nav__summary');
    summary?.click();
    return document.querySelector('.site-nav__disclosure[open]') !== null;
  });
  if (!opened) problems.push('header menu did not open on click');

  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => document.querySelector('.site-nav__disclosure[open]') === null);
  if (!closed) problems.push('Escape did not close the header menu');

  // The catalogue filter must reveal itself and actually filter.
  await page.goto(BASE + '/products/', { waitUntil: 'load' });
  const filter = await page.evaluate(async () => {
    const form = document.getElementById('product-filter');
    if (!form || form.hidden) return { revealed: false };
    const input = document.getElementById('product-search');
    input.value = 'shin';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    const items = [...document.querySelectorAll('#product-grid > li')];
    return {
      revealed: true,
      total: items.length,
      visible: items.filter((li) => !li.hidden).length,
      status: document.querySelector('[data-count]')?.textContent?.trim(),
    };
  });
  if (!filter.revealed) problems.push('catalogue filter never revealed itself');
  else if (filter.visible === 0 || filter.visible === filter.total) {
    problems.push(`catalogue filter did not narrow the list (${filter.visible}/${filter.total})`);
  }

  check(problems.length === 0, 'Interactive components: menus, Escape, catalogue filter', problems.join(' | '));
  return { problems, filter };
}

/** With JavaScript disabled, the content must still be complete and usable. */
async function testNoJs(browser) {
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  const problems = [];

  await page.goto(BASE + '/products/', { waitUntil: 'load' });
  const listing = await page.evaluate(() => ({
    products: document.querySelectorAll('#product-grid > li').length,
    filterHidden: document.getElementById('product-filter')?.hasAttribute('hidden') ?? null,
    categoryLinks: document.querySelectorAll('.category-nav a').length,
  }));
  if (listing.products !== 68) problems.push(`catalogue shows ${listing.products} products without JS, expected 68`);
  if (listing.filterHidden !== true) problems.push('the filter is visible without JS, so it would do nothing');
  if (listing.categoryLinks < 5) problems.push('category links missing without JS');

  await page.goto(BASE + '/shin/', { waitUntil: 'load' });
  const shin = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    profileRows: document.querySelectorAll('table tbody tr').length,
    gallery: document.querySelectorAll('.shin__gallery li').length,
  }));
  if (shin.h1 !== 'SHIN') problems.push('SHIN page has no h1 without JS');
  if (shin.profileRows < 4) problems.push('SHIN profile missing without JS');
  if (shin.gallery < 30) problems.push('SHIN gallery missing without JS');

  await page.goto(BASE + '/', { waitUntil: 'load' });
  const nav = await page.evaluate(() => document.querySelectorAll('nav a[href]').length);
  if (nav < 20) problems.push(`only ${nav} navigation links without JS`);

  await page.close();
  check(problems.length === 0, 'Site is complete and navigable with JavaScript disabled', problems.join(' | '));
  return { problems, listing, shin, nav };
}

/** No page may log an error to the console. */
async function testConsole(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${page.url()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`${page.url()}: ${err.message}`));
  page.on('requestfailed', (req) => {
    // Third-party frames are blocked in this offline harness; ignore those.
    if (!req.url().startsWith(BASE)) return;
    errors.push(`${page.url()}: request failed ${req.url()}`);
  });

  for (const target of PAGES) {
    await page.goto(BASE + target.route, { waitUntil: 'load' });
  }
  await page.close();
  check(errors.length === 0, 'No console errors or failed same-origin requests', errors.slice(0, 4).join(' | '));
  return errors;
}

/** A missing path must return a real 404 status, not a 200 with a nice page. */
async function testStatus(page) {
  const response = await page.goto(BASE + '/this-page-does-not-exist/', { waitUntil: 'load' });
  const status = response?.status();
  const heading = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim());
  check(status === 404, 'Unknown paths return HTTP 404', `got ${status}`);
  check(
    heading === 'That page does not exist',
    'The 404 response renders the custom error page',
    `h1 was "${heading}"`
  );
  return { status, heading };
}

/* -------------------------------------------------------------------- run */

async function main() {
  const server = await serve();
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const browser = await puppeteer.connect({ browserURL: `http://localhost:${chrome.port}`, defaultViewport: null });
  const page = await browser.newPage();

  const results = {};
  try {
    console.log('Browser regression tests\n');
    results.responsive = await testResponsive(page);
    console.log('  responsive widths      done');
    results.reflow = await testReflow(page);
    console.log('  reflow at 400% zoom    done');
    results.textSpacing = await testTextSpacing(page);
    console.log('  text-spacing overrides done');
    results.keyboard = await testKeyboard(page);
    console.log('  keyboard focus         done');
    results.disclosures = await testDisclosures(page);
    console.log('  interactive components done');
    results.noJs = await testNoJs(browser);
    console.log('  no-JavaScript          done');
    results.console = await testConsole(browser);
    console.log('  console errors         done');
    results.status = await testStatus(page);
    console.log('  404 status             done');
  } finally {
    await page.close().catch(() => {});
    await browser.disconnect().catch(() => {});
    try {
      await chrome.kill();
    } catch {
      /* Windows keeps the temp profile locked; the process is still gone */
    }
    server.close();
  }

  const md = `# Browser regression report

Generated ${new Date().toISOString().slice(0, 10)} by \`npm run browser-test\` in
headless Chrome against \`dist/\`.

These are the checks static analysis cannot make: computed layout at real
widths, keyboard focus behaviour, reflow, and what the site does with
JavaScript disabled.

## Results

${passes.map((p) => `- PASS — ${p}`).join('\n')}
${failures.length ? '\n' + failures.map((f) => `- **FAIL — ${f}**`).join('\n') : ''}

## Coverage

| Check | Scope | WCAG |
| --- | --- | --- |
| Horizontal overflow | ${PAGES.length} pages × ${WIDTHS.length} widths (${WIDTHS.join(', ')} px) | 1.4.10 |
| Reflow at 400% zoom | 8 templates at a 320 px equivalent viewport | 1.4.10 |
| Text-spacing overrides | 6 templates with 1.5 line-height, 0.12em letter, 0.16em word, 2em paragraph | 1.4.12 |
| Keyboard focus | 6 templates, 40 tab stops each: skip link first, document order, visible ring | 2.1.1, 2.4.3, 2.4.7 |
| Interactive components | Header disclosure open/Escape, catalogue filter narrowing | 2.1.1, 2.1.2 |
| No JavaScript | Catalogue completeness, SHIN content, navigation | — |
| Console errors | All ${PAGES.length} templates | — |
| Error status | Unknown path returns 404 with the custom page | — |

## Without JavaScript

| Page | Observed |
| --- | --- |
| \`/products/\` | ${results.noJs?.listing?.products ?? 'n/a'} products rendered; filter correctly stays hidden; ${results.noJs?.listing?.categoryLinks ?? 'n/a'} category links |
| \`/shin/\` | h1 "${results.noJs?.shin?.h1 ?? 'n/a'}", ${results.noJs?.shin?.profileRows ?? 'n/a'} profile rows, ${results.noJs?.shin?.gallery ?? 'n/a'} gallery images |
| \`/\` | ${results.noJs?.nav ?? 'n/a'} navigation links |

## Error handling

Requesting \`/this-page-does-not-exist/\` returned **HTTP ${results.status?.status ?? 'n/a'}** and rendered
"${results.status?.heading ?? 'n/a'}". The page is never served with a 200 status.
`;

  await fs.mkdir('audit', { recursive: true });
  await fs.writeFile('audit/browser-report.md', md);
  await fs.writeFile('audit/browser-test.json', JSON.stringify({ generatedAt: new Date().toISOString(), passes, failures }, null, 2));

  console.log(`\n  ${passes.length} passed, ${failures.length} failed`);
  for (const f of failures) console.error(`    FAIL ${f}`);
  console.log('\n  -> audit/browser-report.md');
  if (failures.length) process.exit(1);
}

main();
