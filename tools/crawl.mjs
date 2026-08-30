/**
 * PHASE 1 — public site crawl.
 *
 * Discovers every publicly reachable eng.nongshim.com URL by following in-scope
 * links from the seeds, plus the AJAX endpoints the source site uses to expose
 * products (which are otherwise unreachable by a crawler).
 *
 * Writes audit/site-inventory.json and audit/site-inventory.csv.
 */
import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { ORIGIN, get, abs } from './lib/fetcher.mjs';

const SEEDS = ['/main/index', '/brand/main/index', '/recipe/recipe_list'];
const IN_SCOPE = (u) => u.startsWith(ORIGIN + '/');
const SKIP_EXT = /\.(css|js|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|pdf|zip|mp4|webm)(\?|$)/i;

/** Query params that meaningfully change the page; all others are dropped. */
const MEANINGFUL_PARAMS = new Set(['tabType', 'recipeId', 'page', 'brandId', 'prodCode']);

function normalize(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  u.hash = '';
  u.protocol = 'https:';
  if (u.hostname !== 'eng.nongshim.com') return null;
  for (const key of [...u.searchParams.keys()]) {
    if (!MEANINGFUL_PARAMS.has(key) || u.searchParams.get(key) === '') u.searchParams.delete(key);
  }
  u.searchParams.sort();
  return u.toString();
}

const text = ($el) => $el.text().replace(/\s+/g, ' ').trim();

function analyze(url, html, status) {
  const $ = cheerio.load(html);

  const headings = [];
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    const t = text($(el));
    if (t) headings.push({ level: Number(el.tagName[1]), text: t });
  });

  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src) images.push({ src: abs(src, url), alt: $(el).attr('alt') ?? null });
  });
  // Background images carry most of the source site's real content imagery.
  $('[style*="background-image"]').each((_, el) => {
    const m = /url\(\s*['"]?([^'")]+)/i.exec($(el).attr('style') || '');
    if (m) images.push({ src: abs(m[1].trim(), url), alt: null, background: true });
  });

  const links = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || /^(javascript:|#|mailto:|tel:)/.test(href)) return;
    links.push({ href: abs(href, url), anchor: text($(el)) });
  });

  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => jsonLd.push($(el).contents().text()));

  const scope = $('#content-block, #view-container').first();
  const bodyText = text(scope.length ? scope : $('body'));

  return {
    url,
    status,
    title: text($('title')) || null,
    metaDescription: $('meta[name="description"]').attr('content')?.trim() ?? null,
    metaKeywords: $('meta[name="keywords"]').attr('content')?.trim() ?? null,
    canonical: $('link[rel="canonical"]').attr('href') ?? null,
    robots: $('meta[name="robots"]').attr('content') ?? null,
    ogTitle: $('meta[property="og:title"]').attr('content') ?? null,
    ogImage: $('meta[property="og:image"]').attr('content') ?? null,
    lang: $('html').attr('lang') ?? null,
    h1: $('h1').map((_, el) => text($(el))).get(),
    headings,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    images,
    links,
    jsonLd,
    bodyText: bodyText.slice(0, 4000),
  };
}

function classify(url) {
  const p = new URL(url).pathname;
  if (p === '/main/index' || p === '/') return 'home';
  if (p.startsWith('/brand/main/viewMore')) return 'internal-ajax';
  if (p.startsWith('/brand/main/container') || p.startsWith('/brand/main/detail')) return 'product-fragment';
  if (p.startsWith('/brand/')) return 'product-listing';
  if (p.startsWith('/recipe/recipe_view')) return 'recipe-detail';
  if (p.startsWith('/recipe/')) return 'recipe-listing';
  if (p.startsWith('/about/')) return 'company';
  if (p.startsWith('/sustainability/')) return 'sustainability';
  if (p.startsWith('/pr/')) return 'pr';
  if (p.startsWith('/investors/')) return 'investors';
  if (p.startsWith('/contact/')) return 'contact';
  return 'other';
}

/** Products live only behind AJAX on the source site; enumerate via viewMore. */
async function discoverProducts() {
  const cards = [];
  const brandIds = new Set();
  for (const tab of ['', 'instant', 'snacks', 'beverages', 'simple']) {
    for (let page = 1; page <= 12; page++) {
      const start = (page - 1) * 24 + 1;
      const end = page * 24;
      const url = `${ORIGIN}/brand/main/viewMore?start=${start}&end=${end}&page=${page}&tabType=${tab}&searchCategory=all&searchWord=`;
      const res = await get(url);
      const $ = cheerio.load(res.body);
      const found = $('[data-brand-id]');
      if (!found.length) break;
      found.each((_, el) => {
        const $el = $(el);
        const inner = $el.children().first();
        const styled = inner.find('.img, .best-product-banner').attr('style') || '';
        const bg = /url\(\s*['"]?([^'")]+)/i.exec(styled);
        cards.push({
          brandId: $el.attr('data-brand-id'),
          tab: tab || 'all',
          name: text($el.find('strong').first()),
          tagline: $el.find('.explanation').first().text().trim(),
          listImage: bg ? bg[1].trim() : null,
          size: inner.hasClass('lg-product') ? 'large' : 'medium',
        });
        brandIds.add($el.attr('data-brand-id'));
      });
      if (found.length < 24) break;
    }
  }
  return { brandIds: [...brandIds], cards };
}

async function discoverRecipes() {
  const found = new Map();
  for (let page = 1; page <= 40; page++) {
    const res = await get(`${ORIGIN}/recipe/recipe_list?page=${page}`);
    const $ = cheerio.load(res.body);
    const items = $('a[href*="recipeId="]');
    if (!items.length) break;
    items.each((_, el) => {
      const id = /recipeId=(\d+)/.exec($(el).attr('href') || '')?.[1];
      if (!id || found.has(id)) return;
      found.set(id, {
        recipeId: id,
        title: text($(el).find('.tit')),
        listImage: $(el).find('img').attr('src') || null,
        listAlt: $(el).find('img').attr('alt') || null,
        listPage: page,
      });
    });
    const pageNumbers = $('.pagination a[href*="page="]')
      .map((_, el) => Number(/page=(\d+)/.exec($(el).attr('href') || '')?.[1] || 0))
      .get();
    if (page >= Math.max(0, ...pageNumbers)) break;
  }
  return [...found.values()];
}

async function main() {
  console.log('-> crawling linked pages');
  const seen = new Map();
  const external = new Map();
  const queue = SEEDS.map((s) => normalize(ORIGIN + s)).filter(Boolean);

  while (queue.length) {
    const url = queue.shift();
    if (!url || seen.has(url) || SKIP_EXT.test(url)) continue;
    const res = await get(url);
    const page = analyze(url, res.body, res.status);
    page.pageType = classify(url);
    page.parents = [];
    seen.set(url, page);
    process.stdout.write(`\r   ${seen.size} crawled, ${queue.length} queued    `);

    for (const { href, anchor } of page.links) {
      if (!href) continue;
      if (!IN_SCOPE(href)) {
        const key = href.split('#')[0];
        if (!external.has(key)) external.set(key, { url: key, anchors: new Set(), sources: new Set() });
        external.get(key).anchors.add(anchor);
        external.get(key).sources.add(url);
        continue;
      }
      const norm = normalize(href);
      if (!norm || SKIP_EXT.test(norm)) continue;
      const existing = seen.get(norm);
      if (existing) {
        if (!existing.parents.includes(url)) existing.parents.push(url);
      } else if (!queue.includes(norm)) {
        queue.push(norm);
      }
    }
  }
  console.log('');

  console.log('-> enumerating products (AJAX only on source)');
  const { brandIds, cards } = await discoverProducts();
  console.log(`   ${brandIds.length} product families`);

  console.log('-> enumerating recipes');
  const recipes = await discoverRecipes();
  console.log(`   ${recipes.length} recipes`);

  console.log('-> fetching recipe detail pages');
  for (const r of recipes) {
    const url = `${ORIGIN}/recipe/recipe_view?recipeId=${r.recipeId}`;
    const res = await get(url);
    const page = analyze(url, res.body, res.status);
    page.pageType = 'recipe-detail';
    page.parents = [`${ORIGIN}/recipe/recipe_list`];
    seen.set(url, page);
  }

  const pages = [...seen.values()].sort((a, b) => a.url.localeCompare(b.url));
  const inventory = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    counts: {
      pages: pages.length,
      productFamilies: brandIds.length,
      recipes: recipes.length,
      externalLinks: external.size,
    },
    pages,
    productCards: cards,
    productFamilyIds: brandIds,
    recipes,
    externalLinks: [...external.values()].map((e) => ({
      url: e.url,
      anchors: [...e.anchors].filter(Boolean),
      sources: [...e.sources],
    })),
  };

  await fs.mkdir('audit', { recursive: true });
  await fs.writeFile('audit/site-inventory.json', JSON.stringify(inventory, null, 2));

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['url', 'status', 'pageType', 'title', 'metaDescription', 'canonical', 'h1Count', 'h1', 'headingCount', 'wordCount', 'imageCount', 'imagesMissingAlt', 'internalLinks', 'inboundLinks'];
  const rows = pages.map((p) =>
    [
      p.url, p.status, p.pageType, p.title, p.metaDescription, p.canonical,
      p.h1.length, p.h1.join(' | '), p.headings.length, p.wordCount,
      p.images.length,
      p.images.filter((i) => !i.background && !i.alt).length,
      p.links.filter((l) => l.href && IN_SCOPE(l.href)).length,
      p.parents.length,
    ].map(esc).join(',')
  );
  await fs.writeFile('audit/site-inventory.csv', [header.join(','), ...rows].join('\n'));

  console.log(`\nOK ${pages.length} pages / ${brandIds.length} products / ${recipes.length} recipes -> audit/site-inventory.json`);
}

main();
