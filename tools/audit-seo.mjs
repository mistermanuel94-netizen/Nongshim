/**
 * PHASE 10/17/18 — SEO, crawl, link and structured-data audit over `dist/`.
 *
 * Crawls the built site exactly as a search engine would: starts at the
 * homepage, follows only links present in the HTML, and checks every reachable
 * page. Reports:
 *
 *   - metadata completeness and uniqueness (title, description, canonical, H1)
 *   - heading hierarchy
 *   - image alt text and intrinsic dimensions
 *   - internal link integrity, including anchors
 *   - orphan pages (built but unreachable by following links)
 *   - duplicate and near-duplicate content
 *   - JSON-LD validity and consistency with the visible page
 *   - sitemap/robots correctness
 *
 * Exit code 1 if any blocking error is found.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { SITE_URL } from '../src/config/site-url.mjs';

const DIST = 'dist';
const errors = [];
const warnings = [];

/* --------------------------------------------------------- file loading -- */

async function walk(dir, base = '') {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, `${base}/${entry.name}`)));
    else if (entry.name.endsWith('.html')) {
      const route = entry.name === 'index.html' ? `${base}/` : `${base}/${entry.name}`;
      out.push({ route: route.replace(/^\/\//, '/'), file: full });
    }
  }
  return out;
}

const text = ($el) => $el.text().replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------- analysis -- */

function analyze(route, html) {
  const $ = cheerio.load(html);

  const links = [];
  $('a[href]').each((_, el) => {
    const $el = $(el);
    // Accessible name: text content, else aria-label, else a child image's alt.
    const anchor =
      text($el) || $el.attr('aria-label')?.trim() || $el.find('img[alt]').first().attr('alt')?.trim() || '';
    links.push({ href: $el.attr('href') ?? '', anchor, rel: $el.attr('rel') ?? null });
  });

  const images = [];
  $('img').each((_, el) => {
    const $el = $(el);
    images.push({
      src: $el.attr('src') ?? '',
      alt: $el.attr('alt'),
      width: $el.attr('width'),
      height: $el.attr('height'),
      loading: $el.attr('loading'),
      fetchpriority: $el.attr('fetchpriority'),
      decorative: $el.attr('aria-hidden') === 'true',
    });
  });

  const headings = [];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    headings.push({ level: Number(el.tagName[1]), text: text($(el)) });
  });

  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      jsonLd.push(JSON.parse(raw));
    } catch (err) {
      errors.push(`${route}: JSON-LD is not valid JSON (${err.message})`);
    }
  });

  const ids = [];
  $('[id]').each((_, el) => ids.push($(el).attr('id')));

  const main = $('main');
  const bodyText = text(main.length ? main : $('body'));

  return {
    route,
    title: text($('title')),
    description: $('meta[name="description"]').attr('content') ?? null,
    canonical: $('link[rel="canonical"]').attr('href') ?? null,
    robots: $('meta[name="robots"]').attr('content') ?? null,
    viewport: $('meta[name="viewport"]').attr('content') ?? null,
    lang: $('html').attr('lang') ?? null,
    ogTitle: $('meta[property="og:title"]').attr('content') ?? null,
    ogDescription: $('meta[property="og:description"]').attr('content') ?? null,
    ogImage: $('meta[property="og:image"]').attr('content') ?? null,
    ogUrl: $('meta[property="og:url"]').attr('content') ?? null,
    twitterCard: $('meta[name="twitter:card"]').attr('content') ?? null,
    h1: $('h1').map((_, el) => text($(el))).get(),
    headings,
    links,
    images,
    jsonLd,
    ids,
    bodyText,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    htmlBytes: Buffer.byteLength(html),
    domNodes: $('*').length,
    inlineScripts: $('script:not([src]):not([type="application/ld+json"])').length,
    externalScripts: $('script[src]').map((_, el) => $(el).attr('src')).get(),
    stylesheets: $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get(),
    iframes: $('iframe').map((_, el) => ({ src: $(el).attr('src'), title: $(el).attr('title'), loading: $(el).attr('loading') })).get(),
  };
}

/* -------------------------------------------------------------- checks --- */

function checkMetadata(page, seenTitles, seenDescriptions) {
  const indexable = !/(^|,\s*)noindex/.test(page.robots ?? '');

  if (!page.title) errors.push(`${page.route}: missing <title>`);
  else if (page.title.length > 65) warnings.push(`${page.route}: title is ${page.title.length} chars — "${page.title}"`);
  else if (page.title.length < 10) warnings.push(`${page.route}: title is very short — "${page.title}"`);

  if (!page.description) errors.push(`${page.route}: missing meta description`);
  else if (page.description.length > 175)
    warnings.push(`${page.route}: description is ${page.description.length} chars`);
  else if (page.description.length < 50)
    warnings.push(`${page.route}: description is only ${page.description.length} chars`);

  if (!page.canonical) errors.push(`${page.route}: missing canonical`);
  else {
    const expected = new URL(page.route === '/404.html' ? '/404/' : page.route, SITE_URL).toString();
    if (page.canonical !== expected) {
      errors.push(`${page.route}: canonical is ${page.canonical}, expected ${expected}`);
    }
  }

  if (page.h1.length === 0) errors.push(`${page.route}: no <h1>`);
  else if (page.h1.length > 1) errors.push(`${page.route}: ${page.h1.length} <h1> elements`);

  if (!page.lang) errors.push(`${page.route}: <html> has no lang attribute`);
  if (!page.viewport) errors.push(`${page.route}: missing viewport meta`);
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\D|$)/.test(page.viewport ?? '')) {
    errors.push(`${page.route}: viewport blocks zoom (WCAG 1.4.4)`);
  }

  for (const [name, value] of [
    ['og:title', page.ogTitle],
    ['og:description', page.ogDescription],
    ['og:url', page.ogUrl],
    ['twitter:card', page.twitterCard],
  ]) {
    if (!value) warnings.push(`${page.route}: missing ${name}`);
  }

  if (indexable) {
    if (seenTitles.has(page.title)) errors.push(`${page.route}: duplicate title with ${seenTitles.get(page.title)}`);
    else seenTitles.set(page.title, page.route);

    if (page.description && seenDescriptions.has(page.description)) {
      errors.push(`${page.route}: duplicate meta description with ${seenDescriptions.get(page.description)}`);
    } else if (page.description) seenDescriptions.set(page.description, page.route);

    if (page.wordCount < 60) warnings.push(`${page.route}: thin content (${page.wordCount} words)`);
  }
}

function checkHeadings(page) {
  let previous = 0;
  for (const h of page.headings) {
    if (!h.text) {
      warnings.push(`${page.route}: empty h${h.level}`);
      continue;
    }
    if (previous && h.level > previous + 1) {
      errors.push(`${page.route}: heading jumps from h${previous} to h${h.level} ("${h.text}")`);
    }
    previous = h.level;
  }
}

function checkImages(page) {
  for (const img of page.images) {
    if (img.alt === undefined) {
      errors.push(`${page.route}: <img> with no alt attribute (${img.src})`);
    }
    if (!img.width || !img.height) {
      errors.push(`${page.route}: <img> without intrinsic width/height (${img.src}) — causes layout shift`);
    }
    if (img.alt && /^(image|img|photo|picture|banner)\b/i.test(img.alt)) {
      warnings.push(`${page.route}: unhelpful alt text "${img.alt}"`);
    }
    if (img.alt && /[ㄱ-ㆎ가-힣]/.test(img.alt)) {
      errors.push(`${page.route}: alt text is not English ("${img.alt}")`);
    }
  }
  const eager = page.images.filter((i) => i.loading !== 'lazy');
  if (eager.length > 3) {
    warnings.push(`${page.route}: ${eager.length} images are not lazy-loaded`);
  }
  const priority = page.images.filter((i) => i.fetchpriority === 'high');
  if (priority.length > 2) {
    warnings.push(`${page.route}: ${priority.length} images marked fetchpriority=high`);
  }
}

function checkDuplicateIds(page) {
  const seen = new Set();
  for (const id of page.ids) {
    if (seen.has(id)) errors.push(`${page.route}: duplicate id "${id}"`);
    seen.add(id);
  }
}

function checkSchema(page) {
  for (const doc of page.jsonLd) {
    const nodes = doc['@graph'] ?? [doc];
    if (!doc['@context']) errors.push(`${page.route}: JSON-LD missing @context`);
    for (const node of nodes) {
      if (!node['@type']) errors.push(`${page.route}: JSON-LD node without @type`);

      if (node['@type'] === 'Product') {
        if (!node.name) errors.push(`${page.route}: Product schema without name`);
        // Never assert commerce facts the public source does not publish.
        for (const forbidden of ['offers', 'aggregateRating', 'review', 'gtin', 'sku']) {
          if (node[forbidden]) errors.push(`${page.route}: Product schema asserts "${forbidden}", which the source does not publish`);
        }
        if (node.name && !page.bodyText.includes(node.name)) {
          errors.push(`${page.route}: Product schema name "${node.name}" does not appear in the page body`);
        }
      }

      if (node['@type'] === 'Recipe') {
        for (const required of ['name', 'image', 'recipeInstructions']) {
          if (!node[required]) errors.push(`${page.route}: Recipe schema missing ${required}`);
        }
        for (const forbidden of ['aggregateRating', 'review', 'nutrition']) {
          if (node[forbidden]) errors.push(`${page.route}: Recipe schema asserts "${forbidden}", which the source does not publish`);
        }
        const steps = node.recipeInstructions ?? [];
        if (Array.isArray(steps)) {
          for (const step of steps) {
            if (step.text && !page.bodyText.includes(step.text)) {
              errors.push(`${page.route}: Recipe step text is not present on the page ("${String(step.text).slice(0, 40)}…")`);
            }
          }
        }
      }

      if (node['@type'] === 'BreadcrumbList') {
        const items = node.itemListElement ?? [];
        for (const [i, item] of items.entries()) {
          if (item.position !== i + 1) errors.push(`${page.route}: BreadcrumbList positions are not sequential`);
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ run -- */

async function main() {
  const files = await walk(DIST);
  const pages = new Map();

  for (const { route, file } of files) {
    const html = await fs.readFile(file, 'utf8');
    pages.set(route, analyze(route, html));
  }

  const seenTitles = new Map();
  const seenDescriptions = new Map();
  for (const page of pages.values()) {
    checkMetadata(page, seenTitles, seenDescriptions);
    checkHeadings(page);
    checkImages(page);
    checkDuplicateIds(page);
    checkSchema(page);
  }

  /* ---- internal links + crawl reachability ---- */
  const assetExists = async (p) => {
    try {
      await fs.access(path.join(DIST, p.replace(/^\//, '')));
      return true;
    } catch {
      return false;
    }
  };

  const reachable = new Set(['/']);
  const queue = ['/'];
  const brokenLinks = [];

  while (queue.length) {
    const route = queue.shift();
    const page = pages.get(route);
    if (!page) continue;
    for (const link of page.links) {
      if (/^(https?:|mailto:|tel:)/.test(link.href)) continue;
      if (!link.anchor) errors.push(`${route}: link to ${link.href} has no accessible text`);
      if (/^(click here|read more|more|here|link)$/i.test(link.anchor)) {
        warnings.push(`${route}: non-descriptive anchor text "${link.anchor}" -> ${link.href}`);
      }

      const [pathPart, hash] = link.href.split('#');
      const target = pathPart || route;

      if (!pathPart && hash) {
        if (!page.ids.includes(hash)) errors.push(`${route}: in-page anchor #${hash} has no matching id`);
        continue;
      }

      if (pages.has(target)) {
        if (hash && !pages.get(target).ids.includes(hash)) {
          errors.push(`${route}: link ${link.href} targets #${hash}, which does not exist on ${target}`);
        }
        if (!reachable.has(target)) {
          reachable.add(target);
          queue.push(target);
        }
      } else if (!(await assetExists(target))) {
        brokenLinks.push({ from: route, to: link.href });
      }
    }
  }

  for (const b of brokenLinks) errors.push(`${b.from}: broken internal link -> ${b.to}`);

  const orphans = [...pages.keys()].filter(
    (r) => !reachable.has(r) && r !== '/404.html' && !r.startsWith('/search/')
  );
  for (const o of orphans) errors.push(`Orphan page: ${o} is built but not reachable by following links from /`);

  /* ---- duplicate content ---- */
  const bodies = new Map();
  for (const page of pages.values()) {
    const key = page.bodyText.slice(0, 2000);
    if (!bodies.has(key)) bodies.set(key, []);
    bodies.get(key).push(page.route);
  }
  const duplicateGroups = [...bodies.values()].filter((v) => v.length > 1);
  for (const group of duplicateGroups) errors.push(`Duplicate page content: ${group.join(', ')}`);

  /* ---- sitemap ---- */
  const sitemap = await fs.readFile(path.join(DIST, 'sitemap-0.xml'), 'utf8');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const indexableRoutes = [...pages.values()]
    .filter((p) => !/noindex/.test(p.robots ?? ''))
    .map((p) => new URL(p.route, SITE_URL).toString());

  for (const url of sitemapUrls) {
    const route = new URL(url).pathname;
    if (!pages.has(route)) errors.push(`Sitemap lists ${url}, which is not a built page`);
    else if (/noindex/.test(pages.get(route).robots ?? '')) errors.push(`Sitemap lists noindex page ${url}`);
  }
  for (const url of indexableRoutes) {
    if (!sitemapUrls.includes(url)) warnings.push(`Indexable page missing from sitemap: ${url}`);
  }

  /* ---- robots ---- */
  const robots = await fs.readFile(path.join(DIST, 'robots.txt'), 'utf8');
  if (!robots.includes('Sitemap:')) errors.push('robots.txt does not reference the sitemap');
  if (/Disallow:\s*\/\s*$/m.test(robots)) errors.push('robots.txt disallows the whole site');
  for (const blocked of ['.css', '.js', '/_assets']) {
    if (robots.includes(`Disallow: ${blocked}`)) errors.push(`robots.txt blocks ${blocked}, which crawlers need to render pages`);
  }

  /* ---- report ---- */
  const stats = {
    pages: pages.size,
    indexable: indexableRoutes.length,
    sitemapUrls: sitemapUrls.length,
    orphans: orphans.length,
    brokenLinks: brokenLinks.length,
    duplicateGroups: duplicateGroups.length,
    withSchema: [...pages.values()].filter((p) => p.jsonLd.length).length,
    totalImages: [...pages.values()].reduce((n, p) => n + p.images.length, 0),
    avgHtmlKb: Math.round([...pages.values()].reduce((n, p) => n + p.htmlBytes, 0) / pages.size / 1024),
    maxDomNodes: Math.max(...[...pages.values()].map((p) => p.domNodes)),
    externalScripts: [...new Set([...pages.values()].flatMap((p) => p.externalScripts))],
  };

  await fs.mkdir('audit', { recursive: true });
  await fs.writeFile(
    'audit/seo-audit.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), stats, errors, warnings }, null, 2)
  );

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  await fs.writeFile(
    'audit/broken-links.csv',
    ['fromPage,brokenTarget', ...brokenLinks.map((b) => [b.from, b.to].map(esc).join(','))].join('\n')
  );
  await fs.writeFile(
    'audit/duplicate-content.csv',
    ['group,pages', ...duplicateGroups.map((g, i) => [i + 1, g.join(' | ')].map(esc).join(','))].join('\n')
  );

  console.log('SEO audit');
  console.log(`  pages crawled       ${stats.pages}`);
  console.log(`  indexable           ${stats.indexable}`);
  console.log(`  in sitemap          ${stats.sitemapUrls}`);
  console.log(`  pages with JSON-LD  ${stats.withSchema}`);
  console.log(`  images              ${stats.totalImages}`);
  console.log(`  avg HTML            ${stats.avgHtmlKb} KB`);
  console.log(`  max DOM nodes       ${stats.maxDomNodes}`);
  console.log(`  external scripts    ${stats.externalScripts.length ? stats.externalScripts.join(', ') : 'none'}`);
  console.log(`  orphan pages        ${stats.orphans}`);
  console.log(`  broken links        ${stats.brokenLinks}`);
  console.log(`  duplicate groups    ${stats.duplicateGroups}`);
  console.log(`\n  ${errors.length} errors, ${warnings.length} warnings`);

  if (warnings.length) {
    console.log('\nWarnings:');
    for (const w of warnings.slice(0, 40)) console.log(`  - ${w}`);
    if (warnings.length > 40) console.log(`  … and ${warnings.length - 40} more (see audit/seo-audit.json)`);
  }
  if (errors.length) {
    console.error('\nErrors:');
    for (const e of errors.slice(0, 60)) console.error(`  - ${e}`);
    if (errors.length > 60) console.error(`  … and ${errors.length - 60} more (see audit/seo-audit.json)`);
    process.exit(1);
  }
}

main();
