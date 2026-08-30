/**
 * Generates the derived audit reports from the JSON produced by the other
 * tools, so every number in the documentation traces to a measurement rather
 * than to prose.
 *
 * Run after `npm run build && npm run audit && npm run lighthouse`.
 */
import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import path from 'node:path';

const read = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const readMaybe = async (f) => {
  try {
    return await read(f);
  } catch {
    return null;
  }
};

const pct = (n, total) => `${((n / total) * 100).toFixed(1)}%`;

async function walkHtml(dir, base = '') {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkHtml(full, `${base}/${e.name}`)));
    else if (e.name.endsWith('.html')) {
      out.push({ route: (e.name === 'index.html' ? `${base}/` : `${base}/${e.name}`).replace(/^\/\//, '/'), file: full });
    }
  }
  return out;
}

/** Structured-data census across the built site. */
async function schemaCensus() {
  const files = await walkHtml('dist');
  const types = new Map();
  const perPage = [];
  let withSchema = 0;

  for (const { route, file } of files) {
    const $ = cheerio.load(await fs.readFile(file, 'utf8'));
    const blocks = $('script[type="application/ld+json"]');
    if (!blocks.length) {
      perPage.push({ route, types: [] });
      continue;
    }
    withSchema++;
    const found = [];
    blocks.each((_, el) => {
      const doc = JSON.parse($(el).contents().text());
      for (const node of doc['@graph'] ?? [doc]) {
        const t = node['@type'];
        if (!t) continue;
        found.push(t);
        types.set(t, (types.get(t) ?? 0) + 1);
      }
    });
    perPage.push({ route, types: found });
  }
  return { total: files.length, withSchema, types: [...types.entries()].sort((a, b) => b[1] - a[1]), perPage };
}

/** Internal link graph: inbound counts, depth from home, anchor variety. */
async function linkGraph() {
  const files = await walkHtml('dist');
  const pages = new Map();
  for (const { route, file } of files) {
    const $ = cheerio.load(await fs.readFile(file, 'utf8'));
    const links = $('main a[href], nav a[href]')
      .map((_, el) => ({ href: ($(el).attr('href') ?? '').split('#')[0], anchor: $(el).text().replace(/\s+/g, ' ').trim() }))
      .get()
      .filter((l) => l.href.startsWith('/'));
    pages.set(route, links);
  }

  const inbound = new Map([...pages.keys()].map((r) => [r, 0]));
  const anchors = new Map();
  for (const [, links] of pages) {
    for (const { href, anchor } of links) {
      if (inbound.has(href)) inbound.set(href, inbound.get(href) + 1);
      if (!anchors.has(href)) anchors.set(href, new Set());
      if (anchor) anchors.get(href).add(anchor);
    }
  }

  // Breadth-first depth from the homepage.
  const depth = new Map([['/', 0]]);
  const queue = ['/'];
  while (queue.length) {
    const route = queue.shift();
    for (const { href } of pages.get(route) ?? []) {
      if (!pages.has(href) || depth.has(href)) continue;
      depth.set(href, depth.get(route) + 1);
      queue.push(href);
    }
  }

  return { pages, inbound, anchors, depth };
}

async function main() {
  const [inventory, products, recipes, seo, a11y, perf, lh, redirects, routes, assets, unavailable] = await Promise.all([
    read('audit/site-inventory.json'),
    read('src/content/products.json'),
    read('src/content/recipes.json'),
    readMaybe('audit/seo-audit.json'),
    readMaybe('audit/a11y-audit.json'),
    readMaybe('audit/performance.json'),
    readMaybe('audit/lighthouse.json'),
    read('data/redirects.json'),
    read('data/routes.json'),
    read('data/assets.json'),
    readMaybe('audit/unavailable-assets.json'),
  ]);

  const schema = await schemaCensus();
  const graph = await linkGraph();

  /* ---------------- structured-data-report.md ---------------- */
  const productPages = schema.perPage.filter((p) => p.types.includes('Product')).length;
  const recipePages = schema.perPage.filter((p) => p.types.includes('Recipe')).length;

  await fs.writeFile(
    'audit/structured-data-report.md',
    `# Structured data report

Generated ${new Date().toISOString().slice(0, 10)} from the built site.

Every page emits **one** JSON-LD block containing a \`@graph\`, so nodes can
reference each other by \`@id\` instead of repeating the Organization on every
page.

## Coverage

| Metric | Value |
| --- | --- |
| Pages built | ${schema.total} |
| Pages with structured data | ${schema.withSchema} (${pct(schema.withSchema, schema.total)}) |
| Product pages with \`Product\` | ${productPages} of ${products.length} |
| Recipe pages with \`Recipe\` | ${recipePages} of ${recipes.length} |

## Types emitted

| Type | Nodes |
| --- | ---: |
${schema.types.map(([t, n]) => `| \`${t}\` | ${n} |`).join('\n')}

## What is deliberately absent

The source site publishes no commerce or ratings data, so none is emitted.
These properties are asserted **nowhere** on the site, and the SEO audit fails
the build if one appears:

- \`Product\`: \`offers\`, \`price\`, \`availability\`, \`sku\`, \`gtin\`, \`aggregateRating\`, \`review\`
- \`Recipe\`: \`aggregateRating\`, \`review\`, \`nutrition\`, \`prepTime\`, \`cookTime\`, \`recipeYield\`
- \`VideoObject\`: \`uploadDate\`, \`thumbnailUrl\` — the source's date field is a CMS
  record timestamp, not a publication date, and no thumbnail is published

\`Recipe\` is emitted only where the page carries a name, an image and
instructions; a recipe missing any of those gets \`WebPage\` alone.

## Consistency

The SEO audit checks, for every page, that:

- each \`Product.name\` appears in the rendered page body
- each \`Recipe\` instruction's text appears in the rendered page body
- \`BreadcrumbList\` positions are sequential from 1
- every \`@graph\` node has a \`@type\` and the document has an \`@context\`

Result at the time of writing: **${seo ? seo.errors.filter((e) => /schema|JSON-LD/i.test(e)).length : 'n/a'} structured-data errors.**
`
  );

  /* ---------------- internal-links.md ---------------- */
  const orphans = [...graph.inbound.entries()].filter(([r, n]) => n === 0 && r !== '/' && r !== '/404.html');
  const deepest = [...graph.depth.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const unreached = [...graph.pages.keys()].filter((r) => !graph.depth.has(r));
  const generic = [...graph.anchors.entries()].filter(([, set]) =>
    [...set].some((a) => /^(click here|read more|more|here|link)$/i.test(a))
  );

  await fs.writeFile(
    'audit/internal-links.md',
    `# Internal link audit

Generated ${new Date().toISOString().slice(0, 10)} from the built site.

## Graph shape

| Metric | Value |
| --- | --- |
| Pages | ${graph.pages.size} |
| Internal links (nav + main) | ${[...graph.pages.values()].reduce((n, l) => n + l.length, 0)} |
| Pages reachable from \`/\` | ${graph.depth.size} |
| Orphans (no inbound link) | ${orphans.length} |
| Maximum crawl depth | ${Math.max(...graph.depth.values())} |
| Pages at depth > 3 | ${[...graph.depth.values()].filter((d) => d > 3).length} |
| Non-descriptive anchors | ${generic.length} |

${unreached.length ? `**Unreachable pages:** ${unreached.join(', ')}` : 'Every built page is reachable by following links from the homepage.'}

## Deepest pages

| Page | Depth |
| --- | ---: |
${deepest.map(([r, d]) => `| \`${r}\` | ${d} |`).join('\n')}

## Most linked pages

| Page | Inbound links |
| --- | ---: |
${[...graph.inbound.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 12)
  .map(([r, n]) => `| \`${r}\` | ${n} |`)
  .join('\n')}

## Relationship coverage

| Relationship | Coverage |
| --- | --- |
| Product → category | ${products.filter((p) => p.categoryPath).length} / ${products.length} |
| Product → related products | ${products.filter((p) => p.relatedProducts.length).length} / ${products.length} |
| Product → recipes that use it | ${products.filter((p) => p.relatedRecipes.length).length} / ${products.length} |
| Recipe → products it uses | ${recipes.filter((r) => r.relatedProducts.length).length} / ${recipes.length} |

A recipe links to a product only where the recipe's own published ingredient
list names that product. ${recipes.filter((r) => !r.relatedProducts.length).length} recipes name no catalogue product — mostly
older competition entries referring to discontinued lines — and are reached
through the recipe index and their sibling recipes instead.
`
  );

  /* ---------------- asset / image audit ---------------- */
  const ok = assets.filter((a) => a.status === 200 && a.bytes > 0);
  const bytes = ok.reduce((n, a) => n + a.bytes, 0);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  await fs.writeFile(
    'audit/image-audit.csv',
    [
      'sourceUrl,localFile,format,width,height,sourceBytes,usageType,entity,role,aboveFold',
      ...assets.flatMap((a) =>
        (a.usages ?? []).map((u) =>
          [a.url, a.file, a.format, a.width, a.height, a.bytes, u.type, u.entity, u.role, u.aboveFold]
            .map(esc)
            .join(',')
        )
      ),
    ].join('\n')
  );

  /* ---------------- console summary ---------------- */
  const summary = {
    generatedAt: new Date().toISOString(),
    source: {
      urlsCrawled: inventory.counts.pages,
      productFamilies: inventory.counts.productFamilies,
      recipes: inventory.counts.recipes,
    },
    rebuild: {
      routes: routes.length,
      redirects: redirects.length,
      products: products.length,
      variants: products.reduce((n, p) => n + p.variants.length, 0),
      recipes: recipes.length,
      assetsAcquired: ok.length,
      assetMegabytes: Number((bytes / 1e6).toFixed(1)),
      assetsUnavailableAtSource: unavailable?.length ?? 0,
    },
    quality: {
      seoErrors: seo?.errors.length ?? null,
      seoWarnings: seo?.warnings.length ?? null,
      a11yViolations: a11y?.violations.length ?? null,
      brokenLinks: seo?.stats.brokenLinks ?? null,
      orphanPages: seo?.stats.orphans ?? null,
      duplicateGroups: seo?.stats.duplicateGroups ?? null,
      worstMobileInitialKb: perf ? Math.round(Math.max(...perf.rows.filter((r) => r.viewport === 'mobile').map((r) => r.initialBytes)) / 1024) : null,
      lighthouseMin: lh
        ? {
            performance: Math.min(...lh.results.map((r) => r.scores.performance)),
            accessibility: Math.min(...lh.results.map((r) => r.scores.accessibility)),
            bestPractices: Math.min(...lh.results.map((r) => r.scores['best-practices'])),
            seo: Math.min(...lh.results.map((r) => r.scores.seo)),
          }
        : null,
    },
  };

  await fs.writeFile('audit/summary.json', JSON.stringify(summary, null, 2));

  console.log('Reports written:');
  console.log('  audit/structured-data-report.md');
  console.log('  audit/internal-links.md');
  console.log('  audit/image-audit.csv');
  console.log('  audit/summary.json');
  console.log('');
  console.log(JSON.stringify(summary, null, 2));
}

main();
