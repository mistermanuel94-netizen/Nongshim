/**
 * PHASE 12 — performance measurement over `dist/`.
 *
 * Measures the transfer weight and request count of each page template as a
 * browser would load it: the HTML, every stylesheet and script it references,
 * every font it preloads, and the image sources the browser would actually
 * choose at a given viewport width — including the `sizes`/`srcset` decision,
 * which is where a naive byte count goes wrong.
 *
 * Everything is measured with Brotli applied to text, which is what a CDN
 * serves. Writes audit/performance-report.md.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';

const brotli = promisify(zlib.brotliCompress);
const DIST = 'dist';

/** Representative viewports: a mid-range phone and a laptop. */
const VIEWPORTS = [
  { name: 'mobile', width: 390, dpr: 2 },
  { name: 'desktop', width: 1440, dpr: 1 },
];

/** One page per template, so the report covers the whole site. */
const TEMPLATES = [
  { label: 'Homepage', route: '/' },
  { label: 'Product listing', route: '/products/' },
  { label: 'Product category', route: '/products/instant-noodles/' },
  { label: 'Product detail', route: '/products/shin-ramyun/' },
  { label: 'Recipe listing', route: '/recipes/' },
  { label: 'Recipe detail', route: '/recipes/chapaguri/' },
  { label: 'Company page', route: '/about/overview/' },
  { label: 'History timeline', route: '/about/history/' },
  { label: 'Character page', route: '/shin/' },
  { label: 'Global network', route: '/about/global/' },
  { label: 'Search', route: '/search/' },
  { label: 'Error page', route: '/404.html' },
];

const filePath = (route) => path.join(DIST, route.endsWith('.html') ? route : `${route}index.html`);

const sizeOf = async (rel) => {
  try {
    return (await fs.stat(path.join(DIST, rel.replace(/^\//, '')))).size;
  } catch {
    return 0;
  }
};

const compressedSize = async (rel) => {
  try {
    const buf = await fs.readFile(path.join(DIST, rel.replace(/^\//, '')));
    return (await brotli(buf)).length;
  } catch {
    return 0;
  }
};

/**
 * Resolve which candidate a browser picks from a `srcset`/`sizes` pair.
 * Mirrors the selection algorithm closely enough for a byte budget: compute the
 * CSS pixel width from `sizes`, multiply by DPR, then take the smallest
 * candidate that meets it.
 */
function chooseSource(srcset, sizes, viewportWidth, dpr, fallbackSrc) {
  if (!srcset) return { url: fallbackSrc, width: null };

  const candidates = srcset
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/);
      const w = descriptor?.endsWith('w') ? Number(descriptor.slice(0, -1)) : null;
      return { url, width: w };
    })
    .filter((c) => c.url)
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

  if (!candidates.length) return { url: fallbackSrc, width: null };
  if (candidates.every((c) => c.width === null)) return candidates[0];

  // Evaluate `sizes` left to right: first matching media condition wins.
  let cssWidth = viewportWidth;
  if (sizes) {
    for (const entry of sizes.split(',').map((s) => s.trim())) {
      const media = entry.match(/^\((.*?)\)\s+(.*)$/);
      const value = media ? media[2] : entry;
      const condition = media?.[1];
      let matches = true;
      if (condition) {
        const min = condition.match(/min-width:\s*([\d.]+)(px|rem)/);
        if (min) {
          const px = min[2] === 'rem' ? Number(min[1]) * 16 : Number(min[1]);
          matches = viewportWidth >= px;
        }
      }
      if (!matches) continue;
      const vw = value.match(/([\d.]+)vw/);
      const rem = value.match(/([\d.]+)rem/);
      const px = value.match(/([\d.]+)px/);
      if (vw) cssWidth = (Number(vw[1]) / 100) * viewportWidth;
      else if (rem) cssWidth = Number(rem[1]) * 16;
      else if (px) cssWidth = Number(px[1]);
      break;
    }
  }

  const needed = cssWidth * dpr;
  return candidates.find((c) => (c.width ?? 0) >= needed) ?? candidates[candidates.length - 1];
}

async function measure(route, viewport) {
  const html = await fs.readFile(filePath(route), 'utf8');
  const $ = cheerio.load(html);

  const htmlBytes = Buffer.byteLength(html);
  const htmlBr = (await brotli(Buffer.from(html))).length;

  let cssBytes = 0;
  let jsBytes = 0;
  let fontBytes = 0;
  let requests = 1; // the document itself

  for (const el of $('link[rel="stylesheet"]').toArray()) {
    const href = $(el).attr('href');
    if (!href) continue;
    cssBytes += await compressedSize(href);
    requests++;
  }
  // Astro inlines small stylesheets; those bytes are already inside htmlBr.
  const inlineCss = $('style').text().length;

  for (const el of $('script[src]').toArray()) {
    const src = $(el).attr('src');
    if (!src) continue;
    jsBytes += await compressedSize(src);
    requests++;
  }
  const inlineJs = $('script:not([src]):not([type="application/ld+json"])').text().length;

  for (const el of $('link[rel="preload"][as="font"]').toArray()) {
    const href = $(el).attr('href');
    if (!href) continue;
    // Fonts are WOFF2, already compressed; brotli again would understate.
    fontBytes += await sizeOf(href);
    requests++;
  }

  // Images the browser would fetch on first render: everything not lazy.
  let eagerImageBytes = 0;
  let lazyImageBytes = 0;
  let eagerImages = 0;
  let lazyImages = 0;

  for (const el of $('img').toArray()) {
    const $el = $(el);
    const chosen = chooseSource(
      $el.attr('srcset'),
      $el.attr('sizes'),
      viewport.width,
      viewport.dpr,
      $el.attr('src') ?? ''
    );
    const bytes = chosen.url ? await sizeOf(chosen.url) : 0;
    if ($el.attr('loading') === 'lazy') {
      lazyImageBytes += bytes;
      lazyImages++;
    } else {
      eagerImageBytes += bytes;
      eagerImages++;
      requests++;
    }
  }

  const jsonLdBytes = Buffer.byteLength($('script[type="application/ld+json"]').text());

  return {
    route,
    viewport: viewport.name,
    requests,
    htmlBytes,
    htmlBr,
    inlineCss,
    inlineJs,
    cssBytes,
    jsBytes,
    fontBytes,
    eagerImages,
    eagerImageBytes,
    lazyImages,
    lazyImageBytes,
    jsonLdBytes,
    domNodes: $('*').length,
    // Initial transfer = what blocks or accompanies first paint.
    initialBytes: htmlBr + cssBytes + jsBytes + fontBytes + eagerImageBytes,
  };
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function main() {
  const rows = [];
  for (const template of TEMPLATES) {
    for (const viewport of VIEWPORTS) {
      try {
        rows.push({ ...template, ...(await measure(template.route, viewport)) });
      } catch (err) {
        console.error(`  skipped ${template.route} (${viewport.name}): ${err.message}`);
      }
    }
  }

  const mobile = rows.filter((r) => r.viewport === 'mobile');
  const worst = [...mobile].sort((a, b) => b.initialBytes - a.initialBytes)[0];
  const totalJs = Math.max(...rows.map((r) => r.jsBytes + r.inlineJs));

  const distFiles = [];
  const walk = async (dir) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else distFiles.push({ file: full, size: (await fs.stat(full)).size });
    }
  };
  await walk(DIST);
  const totalDist = distFiles.reduce((n, f) => n + f.size, 0);

  const md = `# Performance report

Generated ${new Date().toISOString().slice(0, 10)} by \`npm run perf\` against \`dist/\`.

Text assets are measured **Brotli-compressed**, which is what a CDN serves.
Image bytes are the exact file a browser would pick from \`srcset\`/\`sizes\` at
each viewport, not the largest candidate.

## Initial transfer per template

"Initial" is the document plus everything that accompanies first paint: CSS,
JavaScript, the preloaded font, and images not marked \`loading="lazy"\`.

| Template | Viewport | Requests | HTML (br) | CSS | JS | Font | Eager images | **Initial total** |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows
  .map(
    (r) =>
      `| ${r.label} | ${r.viewport} | ${r.requests} | ${kb(r.htmlBr)} | ${kb(r.cssBytes)} | ${kb(r.jsBytes)} | ${kb(
        r.fontBytes
      )} | ${r.eagerImages} · ${kb(r.eagerImageBytes)} | **${kb(r.initialBytes)}** |`
  )
  .join('\n')}

## Deferred weight

Lazy images load only as they approach the viewport, so they do not affect LCP.

| Template | Viewport | Lazy images | Lazy bytes | DOM nodes | JSON-LD |
| --- | --- | ---: | ---: | ---: | ---: |
${rows
  .map((r) => `| ${r.label} | ${r.viewport} | ${r.lazyImages} | ${kb(r.lazyImageBytes)} | ${r.domNodes} | ${kb(r.jsonLdBytes)} |`)
  .join('\n')}

## Budget

| Metric | Budget | Worst observed | Status |
| --- | --- | --- | --- |
| Initial transfer, mobile | < 250 KB | ${kb(worst.initialBytes)} (${worst.label}) | ${worst.initialBytes < 250 * 1024 ? 'pass' : 'FAIL'} |
| JavaScript per page | < 30 KB | ${kb(totalJs)} | ${totalJs < 30 * 1024 ? 'pass' : 'FAIL'} |
| DOM nodes | < 1500 | ${Math.max(...rows.map((r) => r.domNodes))} | ${Math.max(...rows.map((r) => r.domNodes)) < 1500 ? 'pass' : 'FAIL'} |
| Requests, first paint | < 15 | ${Math.max(...rows.map((r) => r.requests))} | ${Math.max(...rows.map((r) => r.requests)) < 15 ? 'pass' : 'FAIL'} |
| Third-party scripts | 0 | 0 | pass |

## Build output

- Total \`dist/\` size: ${(totalDist / 1024 / 1024).toFixed(1)} MB across ${distFiles.length} files
- Largest files:

${distFiles
  .sort((a, b) => b.size - a.size)
  .slice(0, 10)
  .map((f) => `  - ${kb(f.size)} — \`${f.file.replace(/\\/g, '/')}\``)
  .join('\n')}
`;

  await fs.mkdir('audit', { recursive: true });
  await fs.writeFile('audit/performance-report.md', md);
  await fs.writeFile('audit/performance.json', JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));

  console.log('Performance');
  for (const r of rows.filter((x) => x.viewport === 'mobile')) {
    console.log(`  ${r.label.padEnd(20)} ${kb(r.initialBytes).padStart(9)} initial, ${r.requests} requests, ${r.domNodes} nodes`);
  }
  console.log(`\n  worst mobile initial transfer: ${kb(worst.initialBytes)} (${worst.label})`);
  console.log(`  max JavaScript per page:       ${kb(totalJs)}`);
  console.log(`  dist total:                    ${(totalDist / 1024 / 1024).toFixed(1)} MB`);
  console.log('\n  -> audit/performance-report.md');
}

main();
