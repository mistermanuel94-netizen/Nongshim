/**
 * PHASE 12 — real-browser Lighthouse audit.
 *
 * Serves `dist/` over HTTP (a static host's behaviour, including the 404) and
 * runs Lighthouse against one page per template, mobile and desktop.
 *
 * Writes audit/lighthouse.json and audit/lighthouse-report.md. Fails if any
 * category drops below its target.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const brotli = promisify(zlib.brotliCompress);

const DIST = 'dist';
const PORT = 4321;

/** Text types a CDN compresses; binary media is already compressed. */
const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript|manifest))/;

const TARGETS = { performance: 95, accessibility: 95, 'best-practices': 95, seo: 100 };

/**
 * Lighthouse's mobile run is CPU-throttled 4x, so a single measurement is
 * sensitive to whatever else the machine is doing. Three runs and take the
 * median, which is what Lighthouse itself recommends for reporting.
 */
const RUNS = Number(process.env.LH_RUNS ?? 3);

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const PAGES = [
  { label: 'Homepage', route: '/' },
  { label: 'Product listing', route: '/products/' },
  { label: 'Product category', route: '/products/instant-noodles/' },
  { label: 'Product detail', route: '/products/shin-ramyun/' },
  { label: 'Recipe listing', route: '/recipes/' },
  { label: 'Recipe detail', route: '/recipes/chapaguri/' },
  { label: 'Company page', route: '/about/overview/' },
  { label: 'Character page', route: '/shin/' },
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
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

/** A static server that behaves like the production host. */
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      let file = path.join(DIST, decodeURIComponent(url.pathname));
      try {
        const stat = await fs.stat(file).catch(() => null);
        if (!stat || stat.isDirectory()) file = path.join(file, 'index.html');
        let body = await fs.readFile(file);
        const ext = path.extname(file);
        const type = MIME[ext] ?? 'application/octet-stream';

        // A CDN brotli-compresses text. Serving it uncompressed here would
        // measure the test rig rather than the site.
        const headers = {
          'content-type': type,
          // Mirror the production cache policy from deploy/_headers.
          'cache-control': /_assets|fonts/.test(file)
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=0, must-revalidate',
          'x-content-type-options': 'nosniff',
        };
        if (COMPRESSIBLE.test(type) && /br/.test(req.headers['accept-encoding'] ?? '')) {
          body = await brotli(body);
          headers['content-encoding'] = 'br';
          headers.vary = 'Accept-Encoding';
        }
        headers['content-length'] = String(body.length);
        res.writeHead(200, headers);
        res.end(body);
      } catch {
        // A real 404 status with the custom page, as the host is configured.
        const notFound = await fs.readFile(path.join(DIST, '404.html')).catch(() => Buffer.from('Not found'));
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end(notFound);
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function run(chrome, url, formFactor) {
  const isMobile = formFactor === 'mobile';
  const result = await lighthouse(
    url,
    { port: chrome.port, output: 'json', logLevel: 'error' },
    {
      extends: 'lighthouse:default',
      settings: {
        formFactor,
        screenEmulation: isMobile
          ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
          : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
        // Lighthouse's standard mobile throttling; desktop uses its own preset.
        throttling: isMobile
          ? { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4, requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675 }
          : { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
        emulatedUserAgent: false,
      },
    }
  );

  const lhr = result.lhr;
  const audit = (id) => lhr.audits[id];
  return {
    formFactor,
    scores: Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)])),
    metrics: {
      fcp: audit('first-contentful-paint')?.numericValue ?? null,
      lcp: audit('largest-contentful-paint')?.numericValue ?? null,
      cls: audit('cumulative-layout-shift')?.numericValue ?? null,
      tbt: audit('total-blocking-time')?.numericValue ?? null,
      si: audit('speed-index')?.numericValue ?? null,
      ttfb: audit('server-response-time')?.numericValue ?? null,
    },
    diagnostics: {
      domSize: audit('dom-size')?.numericValue ?? null,
      transferBytes: audit('total-byte-weight')?.numericValue ?? null,
      unusedCss: audit('unused-css-rules')?.details?.overallSavingsBytes ?? 0,
      unusedJs: audit('unused-javascript')?.details?.overallSavingsBytes ?? 0,
    },
    failed: Object.values(lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable')
      .map((a) => ({ id: a.id, title: a.title, score: a.score, display: a.displayValue ?? null })),
  };
}

const ms = (v) => (v === null ? 'n/a' : `${Math.round(v)} ms`);
const cls = (v) => (v === null ? 'n/a' : v.toFixed(3));

const CHROME_FLAGS = ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'];

const launchChrome = () => chromeLauncher.launch({ chromeFlags: CHROME_FLAGS });

/** Windows keeps the temp profile locked; the process itself is still gone. */
const killChrome = async (chrome) => {
  try {
    await chrome.kill();
  } catch {
    /* temp profile cleanup failed */
  }
};

async function main() {
  const server = await serve();
  let chrome = await launchChrome();
  console.log(`Lighthouse — serving dist/ on http://localhost:${PORT}\n`);

  /**
   * Headless Chrome occasionally drops its DevTools connection part-way through
   * a long batch ("Target closed"). That is a harness failure, not a result, so
   * relaunch the browser and take the measurement again rather than losing the
   * whole report.
   */
  const runWithRetry = async (url, formFactor) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await run(chrome, url, formFactor);
      } catch (error) {
        const transport = /Target closed|Protocol error|ECONNREFUSED|socket hang up|WebSocket/i.test(
          String(error?.message ?? error)
        );
        if (!transport || attempt === 2) throw error;
        process.stdout.write('(chrome dropped, relaunching) ');
        await killChrome(chrome);
        chrome = await launchChrome();
      }
    }
    throw new Error('unreachable');
  };

  const results = [];
  try {
    for (const page of PAGES) {
      for (const formFactor of ['mobile', 'desktop']) {
        const url = `http://localhost:${PORT}${page.route}`;
        process.stdout.write(`  ${page.label} (${formFactor})… `);

        const runsForPage = [];
        for (let i = 0; i < RUNS; i++) runsForPage.push(await runWithRetry(url, formFactor));

        // Report the median of each measurement independently: a single "median
        // run" would hide a metric that was bad in two runs out of three.
        const r = {
          ...runsForPage[0],
          runs: RUNS,
          scores: Object.fromEntries(
            Object.keys(runsForPage[0].scores).map((k) => [k, median(runsForPage.map((x) => x.scores[k]))])
          ),
          metrics: Object.fromEntries(
            Object.keys(runsForPage[0].metrics).map((k) => [
              k,
              median(runsForPage.map((x) => x.metrics[k] ?? 0)),
            ])
          ),
          // An audit only counts as failing if it failed in the majority of runs.
          failed: (() => {
            const counts = new Map();
            for (const one of runsForPage) {
              for (const a of one.failed) {
                if (!counts.has(a.id)) counts.set(a.id, { ...a, seen: 0 });
                counts.get(a.id).seen++;
              }
            }
            return [...counts.values()].filter((a) => a.seen > RUNS / 2);
          })(),
        };

        results.push({ ...page, ...r });
        const s = r.scores;
        console.log(
          `P ${s.performance} A ${s.accessibility} BP ${s['best-practices']} SEO ${s.seo}  ` +
            `LCP ${ms(r.metrics.lcp)}  CLS ${cls(r.metrics.cls)}  TBT ${ms(r.metrics.tbt)}`
        );
      }
    }
  } finally {
    await killChrome(chrome);
    server.close();
  }

  const below = [];
  for (const r of results) {
    for (const [category, target] of Object.entries(TARGETS)) {
      if ((r.scores[category] ?? 0) < target) {
        below.push(`${r.label} (${r.formFactor}) ${category}: ${r.scores[category]} < ${target}`);
      }
    }
  }

  const allFailedAudits = new Map();
  for (const r of results) {
    for (const a of r.failed) {
      if (!allFailedAudits.has(a.id)) allFailedAudits.set(a.id, { ...a, pages: [] });
      allFailedAudits.get(a.id).pages.push(`${r.label}/${r.formFactor}`);
    }
  }

  const md = `# Lighthouse report

Generated ${new Date().toISOString().slice(0, 10)} by \`npm run lighthouse\`, against \`dist/\`
served over HTTP with brotli and the production cache headers. Mobile runs use
Lighthouse's standard 4x CPU slowdown and Slow 4G throttling.

Each figure is the **median of ${RUNS} runs**; a throttled mobile run varies by
several points between repeats, so a single run is not reportable.

## Scores

| Page | Form factor | Performance | Accessibility | Best practices | SEO |
| --- | --- | ---: | ---: | ---: | ---: |
${results
  .map(
    (r) =>
      `| ${r.label} | ${r.formFactor} | ${r.scores.performance} | ${r.scores.accessibility} | ${r.scores['best-practices']} | ${r.scores.seo} |`
  )
  .join('\n')}

**Targets:** Performance 95+, Accessibility 95+, Best practices 95+, SEO 100.

${below.length ? `**Below target:**\n\n${below.map((b) => `- ${b}`).join('\n')}` : 'All pages meet every target.'}

## Core Web Vitals

Lab measurements. Field data (CrUX) will differ; see docs/performance.md for the
post-launch monitoring plan.

| Page | Form factor | FCP | LCP | CLS | TBT | Speed Index |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${results
  .map(
    (r) =>
      `| ${r.label} | ${r.formFactor} | ${ms(r.metrics.fcp)} | ${ms(r.metrics.lcp)} | ${cls(r.metrics.cls)} | ${ms(
        r.metrics.tbt
      )} | ${ms(r.metrics.si)} |`
  )
  .join('\n')}

**Thresholds:** LCP < 2500 ms, CLS < 0.1, TBT < 200 ms (a lab proxy for INP).

## Remaining Lighthouse audits below 1.0

${
  allFailedAudits.size
    ? `| Audit | Score | Detail | Pages |\n| --- | ---: | --- | --- |\n${[...allFailedAudits.values()]
        .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
        .map((a) => `| ${a.title} | ${a.score?.toFixed(2)} | ${a.display ?? ''} | ${a.pages.length} |`)
        .join('\n')}`
    : 'None.'
}
`;

  await fs.mkdir('audit', { recursive: true });
  await fs.writeFile('audit/lighthouse-report.md', md);
  await fs.writeFile('audit/lighthouse.json', JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  console.log(`\n  -> audit/lighthouse-report.md`);
  if (below.length) {
    console.error('\n  Below target:');
    for (const b of below) console.error(`    - ${b}`);
    process.exit(1);
  }
  console.log('  All pages meet every target.');
}

main();
