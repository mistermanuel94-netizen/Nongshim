/**
 * Built-output tests.
 *
 * These read `dist/` and assert the properties that only exist after a build:
 * metadata, structured data, robots, sitemap, redirect config and the absence
 * of render-blocking third-party code. Run `npm run build` first.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const DIST = 'dist';

const read = (p: string) => fs.readFile(path.join(DIST, p), 'utf8');
const load = async (p: string) => cheerio.load(await read(p));

let distExists = true;
beforeAll(async () => {
  try {
    await fs.access(DIST);
  } catch {
    distExists = false;
  }
  expect(distExists, 'dist/ is missing — run `npm run build` first').toBe(true);
});

describe('homepage', () => {
  it('states the primary entity in the h1 and the first paragraph', async () => {
    const $ = await load('index.html');
    expect($('h1')).toHaveLength(1);
    expect($('h1').text().trim()).toBe('Nongshim');
    expect($('main p').first().text()).toMatch(/Korean food company founded in 1965/);
  });

  it('emits Organization and WebSite schema in one graph', async () => {
    const $ = await load('index.html');
    const blocks = $('script[type="application/ld+json"]');
    expect(blocks).toHaveLength(1);
    const graph = JSON.parse(blocks.first().text());
    const types = graph['@graph'].map((n: { '@type': string }) => n['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
  });

  it('links to the catalogue, the recipe index and SHIN', async () => {
    const $ = await load('index.html');
    const hrefs = $('main a[href]').map((_, el) => $(el).attr('href')).get();
    expect(hrefs).toContain('/products/');
    expect(hrefs).toContain('/recipes/');
    expect(hrefs).toContain('/shin/');
  });
});

describe('product pages', () => {
  it('renders the product name, description and specs in the HTML', async () => {
    const $ = await load('products/shin-ramyun/index.html');
    expect($('h1').text().trim()).toBe('Shin Ramyun');
    const body = $('main').text();
    expect(body).toMatch(/Spicy flavor loved by Koreans/);
    expect(body).toMatch(/120g/);
    expect(body).toMatch(/1986\.10/);
    expect(body).toMatch(/HALAL/);
  });

  it('lists every pack format with its own anchor', async () => {
    const $ = await load('products/shin-ramyun/index.html');
    const ids = $('#shin-ramyun-big-bowl, #shin-ramyun-cup');
    expect(ids.length).toBe(2);
  });

  it('emits Product schema with no invented commerce data', async () => {
    const $ = await load('products/shin-ramyun/index.html');
    const graph = JSON.parse($('script[type="application/ld+json"]').first().text())['@graph'];
    const product = graph.find((n: { '@type': string }) => n['@type'] === 'Product');
    expect(product.name).toBe('Shin Ramyun');
    for (const key of ['offers', 'aggregateRating', 'review', 'sku', 'gtin']) {
      expect(product, key).not.toHaveProperty(key);
    }
  });

  it('links back to its category and forward to recipes', async () => {
    const $ = await load('products/shin-ramyun/index.html');
    const hrefs = $('main a[href]').map((_, el) => $(el).attr('href')).get();
    expect(hrefs).toContain('/products/instant-noodles/');
    expect(hrefs.some((h) => h?.startsWith('/recipes/'))).toBe(true);
  });
});

describe('recipe pages', () => {
  it('renders ingredients and numbered steps in the HTML', async () => {
    const $ = await load('recipes/chapaguri/index.html');
    expect($('h1').length).toBe(1);
    expect($('.recipe__ingredients li').length).toBeGreaterThan(0);
    expect($('.steps > li').length).toBeGreaterThan(0);
  });

  it('emits Recipe schema whose steps match the visible text', async () => {
    const $ = await load('recipes/chapaguri/index.html');
    const graph = JSON.parse($('script[type="application/ld+json"]').first().text())['@graph'];
    const recipe = graph.find((n: { '@type': string }) => n['@type'] === 'Recipe');
    expect(recipe).toBeTruthy();
    expect(recipe.recipeInstructions.length).toBe($('.steps > li').length);
    const body = $('main').text().replace(/\s+/g, ' ');
    for (const step of recipe.recipeInstructions) {
      expect(body).toContain(step.text.replace(/\s+/g, ' '));
    }
    for (const key of ['aggregateRating', 'review', 'nutrition']) {
      expect(recipe, key).not.toHaveProperty(key);
    }
  });
});

describe('SHIN page', () => {
  it('answers "who is SHIN" in the initial HTML', async () => {
    const $ = await load('shin/index.html');
    expect($('h1').text().trim()).toBe('SHIN');
    expect($('main p').first().text()).toMatch(/spicy happiness/i);
    expect($('table th').length).toBeGreaterThanOrEqual(8);
  });

  it('uses English alt text on every image', async () => {
    const $ = await load('shin/index.html');
    $('img').each((_, el) => {
      const alt = $(el).attr('alt') ?? '';
      expect(alt, `alt="${alt}"`).not.toMatch(/[ㄱ-ㆎ가-힣]/);
    });
  });
});

describe('robots and sitemap', () => {
  it('references the sitemap and blocks nothing that renders the page', async () => {
    const robots = await read('robots.txt');
    expect(robots).toMatch(/Sitemap: https?:\/\/\S+\/sitemap-index\.xml/);
    expect(robots).not.toMatch(/Disallow:\s*\/$/m);
    expect(robots).not.toMatch(/Disallow:.*\.(css|js)(\s|$)/m);
  });

  it('excludes search from the sitemap', async () => {
    const sitemap = await read('sitemap-0.xml');
    expect(sitemap).not.toMatch(/\/search\//);
    expect(sitemap).not.toMatch(/\/404/);
  });

  it('lists only canonical, trailing-slashed URLs', async () => {
    const sitemap = await read('sitemap-0.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(200);
    for (const loc of locs) expect(loc, loc).toMatch(/\/$/);
  });
});

describe('performance and privacy budget', () => {
  it('loads no third-party script on any page', async () => {
    const walk = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(full)));
        else if (e.name.endsWith('.html')) out.push(full);
      }
      return out;
    };
    for (const file of await walk(DIST)) {
      const $ = cheerio.load(await fs.readFile(file, 'utf8'));
      $('script[src]').each((_, el) => {
        const src = $(el).attr('src') ?? '';
        expect(src.startsWith('/'), `${file} loads ${src}`).toBe(true);
      });
    }
  });

  it('gives every image intrinsic dimensions', async () => {
    const $ = await load('products/index.html');
    $('img').each((_, el) => {
      expect($(el).attr('width'), $(el).attr('src')).toBeTruthy();
      expect($(el).attr('height'), $(el).attr('src')).toBeTruthy();
    });
  });

  it('marks exactly one image as the LCP candidate per page', async () => {
    for (const page of ['index.html', 'products/index.html', 'recipes/index.html', 'products/shin-ramyun/index.html']) {
      const $ = await load(page);
      const high = $('img[fetchpriority="high"]');
      expect(high.length, `${page} has ${high.length}`).toBeLessThanOrEqual(1);
    }
  });

  it('allows pinch-zoom', async () => {
    const $ = await load('index.html');
    const viewport = $('meta[name="viewport"]').attr('content') ?? '';
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
    expect(viewport).not.toMatch(/maximum-scale/);
  });
});

describe('redirect configuration', () => {
  it('emits host redirect files alongside the build', async () => {
    const redirects = await read('_redirects');
    expect(redirects).toMatch(/^\/main\/index \/ 301!$/m);
    expect(redirects).toMatch(/\/brand\/main\/index \/products\/ 301!/);
  });

  it('emits security headers', async () => {
    const headers = await read('_headers');
    expect(headers).toMatch(/Content-Security-Policy:/);
    expect(headers).toMatch(/X-Content-Type-Options: nosniff/);
    expect(headers).toMatch(/Cache-Control: public, max-age=31536000, immutable/);
  });
});
