/**
 * PHASE 2 — information architecture.
 *
 * Single source of truth for the legacy -> new URL mapping. Emits
 * audit/url-map.md and audit/redirect-map.csv, plus data/redirects.json which
 * the site consumes to generate host redirect configuration.
 *
 * Policy: preserve the source path where it is already clean and descriptive;
 * replace only query-driven and non-descriptive routes. Every changed URL gets
 * a 301 with a stated reason, and no redirect points at another redirect.
 */
import fs from 'node:fs/promises';
import {
  PRESERVED_SECTIONS as PRESERVED,
  RENAMED_SECTIONS as RENAMED,
  LEGACY_CATEGORY_TABS as LEGACY_TAB,
  RECIPES_PER_PAGE,
  LEGACY_RECIPE_PAGES,
  newSectionPath,
} from '../src/config/routes.mjs';

const read = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));


const CATEGORY_PATH = {
  'instant-noodles': '/products/instant-noodles/',
  snacks: '/products/snacks/',
  beverages: '/products/beverages/',
  'home-meal-replacement': '/products/home-meal-replacement/',
};


async function main() {
  const [products, recipes, inventory] = await Promise.all([
    read('data/products.json'),
    read('data/recipes.json'),
    read('audit/site-inventory.json'),
  ]);

  /** @type {{from:string,to:string,status:number,reason:string}[]} */
  const redirects = [];
  const add = (from, to, reason, status = 301) => redirects.push({ from, to, status, reason });

  // --- Entry point -------------------------------------------------------
  add('/main/index', '/', 'Homepage moved to the site root; the source served it behind a client-side JS redirect (R-01)');

  // --- Preserved section paths ------------------------------------------
  for (const p of PRESERVED) {
    const to = newSectionPath(p);
    if (to !== p) {
      add(p, to, RENAMED[p] ? 'Renamed for readability; legacy path preserved by redirect' : 'Trailing-slash normalisation');
    }
  }

  // --- Products ----------------------------------------------------------
  add('/brand/main/index', '/products/', 'Product catalogue given a descriptive, crawlable path; the source route exposed no product URLs at all (R-06)');
  for (const [tab, to] of Object.entries(LEGACY_TAB)) {
    add(`/brand/main/index?tabType=${tab}`, to, 'Client-side category tab promoted to an indexable category page (R-07)');
  }
  for (const p of products) {
    // The source had no product URL to preserve; these map the AJAX fragment
    // endpoints so any deep link that exists in the wild still resolves.
    add(`/brand/main/container?brandId=${p.id}`, `/products/${p.slug}/`, 'AJAX-only product fragment promoted to an indexable page (R-06)');
    for (const v of p.variants) {
      add(`/brand/main/detail?prodCode=${v.prodCode}`, `/products/${p.slug}/#${v.slug}`, 'Variant fragment mapped to its anchor on the product page');
    }
  }

  // --- Recipes -----------------------------------------------------------
  add('/recipe/recipe_list', '/recipes/', 'Descriptive plural path');
  // The source paginated 15 per page over 7 pages; the rebuild shows 24 per
  // page. Legacy page numbers beyond the new range collapse to the index so no
  // inbound link 404s.
  const newRecipePages = Math.ceil(recipes.length / RECIPES_PER_PAGE);
  for (let page = 2; page <= LEGACY_RECIPE_PAGES; page++) {
    const to = page <= newRecipePages ? `/recipes/page/${page}/` : '/recipes/';
    add(
      `/recipe/recipe_list?page=${page}`,
      to,
      page <= newRecipePages
        ? 'Query pagination replaced by a crawlable path'
        : 'Legacy page beyond the new pagination range; collapsed to the recipe index'
    );
  }
  for (const r of recipes) {
    const to = `/recipes/${r.slug}/`;
    add(`/recipe/recipe_view?recipeId=${r.id}`, to, 'Query-parameter recipe URL replaced by a descriptive slug');
    // The source exposed every recipe at a second URL carrying the list page
    // number, with no canonical (duplicate-content finding). Both collapse here.
    for (let page = 1; page <= LEGACY_RECIPE_PAGES; page++) {
      add(`/recipe/recipe_view?page=${page}&recipeId=${r.id}`, to, 'Duplicate paginated recipe URL collapsed to the canonical recipe page');
    }
  }

  // --- Removed / broken source routes ------------------------------------
  add('/pr/pedia', '/press/', 'Source page rendered a header with no content; consolidated into the press index');
  add('/pr/pedia/detail', '/press/', 'Source page returned an empty document; consolidated into the press index');
  add('/contact/inquiry_check', '/contact/inquiry/', 'Stateful lookup step folded into the enquiry page');
  add('/investors/ir/view', '/investors/ir/', 'Source route returned HTTP 404; points at the IR index instead');
  add('/investors/finance/audit_view', '/investors/audit/', 'Source route returned HTTP 404; points at the audit index instead');

  // --- New routes with no legacy equivalent ------------------------------
  const newRoutes = [
    { path: '/', type: 'home' },
    { path: '/products/', type: 'product-listing' },
    ...Object.values(CATEGORY_PATH).map((path) => ({ path, type: 'product-category' })),
    ...products.map((p) => ({ path: `/products/${p.slug}/`, type: 'product-detail' })),
    { path: '/recipes/', type: 'recipe-listing' },
    ...Array.from({ length: Math.max(0, Math.ceil(recipes.length / RECIPES_PER_PAGE) - 1) }, (_, i) => ({
      path: `/recipes/page/${i + 2}/`,
      type: 'recipe-listing',
    })),
    ...recipes.map((r) => ({ path: `/recipes/${r.slug}/`, type: 'recipe-detail' })),
    { path: '/shin/', type: 'character' },
    { path: '/search/', type: 'search' },
    ...PRESERVED.map((p) => ({ path: newSectionPath(p), type: 'section' })),
    { path: '/404.html', type: 'error' },
  ];

  // Guard: a redirect must never target another redirect (no chains).
  const targets = new Set(newRoutes.map((r) => r.path));
  const fromPaths = new Set(redirects.map((r) => r.from.split('?')[0]));
  const chains = redirects.filter((r) => fromPaths.has(r.to.split('#')[0]));
  const danglingTargets = redirects.filter((r) => !targets.has(r.to.split('#')[0]));

  await fs.writeFile('data/redirects.json', JSON.stringify(redirects, null, 2));
  await fs.writeFile('data/routes.json', JSON.stringify(newRoutes, null, 2));

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  await fs.writeFile(
    'audit/redirect-map.csv',
    ['oldUrl,newUrl,status,reason', ...redirects.map((r) => [r.from, r.to, r.status, r.reason].map(esc).join(','))].join('\n')
  );

  // --- url-map.md --------------------------------------------------------
  const byType = {};
  for (const r of newRoutes) byType[r.type] = (byType[r.type] ?? 0) + 1;

  const legacyPaths = [...new Set(inventory.pages.map((p) => new URL(p.url).pathname))].sort();

  const md = `# URL Map

Generated ${new Date().toISOString().slice(0, 10)} from \`data/products.json\`, \`data/recipes.json\`
and \`audit/site-inventory.json\`. This file is derived — edit \`tools/ia.mjs\`, not this.

## Policy

1. **Preserve** a source path when it is already clean, descriptive and indexable.
   All of \`/about/*\`, \`/sustainability/*\`, \`/pr/*\`, \`/investors/*\` and \`/contact/*\`
   keep their paths; only a trailing slash is added for consistency.
2. **Replace** a source route when it is query-driven, non-descriptive, or exposes no
   URL at all. Products and recipes fall here.
3. **Every** replaced URL gets a 301 with a stated reason. No redirect targets another
   redirect.
4. Trailing slashes are canonical site-wide (\`trailingSlash: 'always'\`).

## New route inventory

| Page type | Count |
| --- | --- |
${Object.entries(byType)
  .sort((a, b) => b[1] - a[1])
  .map(([t, n]) => `| ${t} | ${n} |`)
  .join('\n')}
| **Total** | **${newRoutes.length}** |

## Section hierarchy

\`\`\`
/                                        Home
├── /products/                           Catalogue index (68 products)
│   ├── /products/instant-noodles/       ${products.filter((p) => p.category === 'instant-noodles').length} products
│   ├── /products/snacks/                ${products.filter((p) => p.category === 'snacks').length} products
│   ├── /products/beverages/             ${products.filter((p) => p.category === 'beverages').length} products
│   ├── /products/home-meal-replacement/ ${products.filter((p) => p.category === 'home-meal-replacement').length} products
│   └── /products/{slug}/                Product detail, variants as #anchors
├── /recipes/                            Recipe index (${recipes.length} recipes)
│   ├── /recipes/page/{2..7}/            Crawlable pagination
│   └── /recipes/{slug}/                 Recipe detail
├── /shin/                               SHIN character (new — was a JS modal)
├── /about/                              Company
│   ├── /about/overview/
│   ├── /about/profile/mission/          Management philosophy
│   ├── /about/profile/way/              The Nongshim Way
│   ├── /about/history/                  1965–2020 timeline
│   ├── /about/ci/                       Corporate identity
│   ├── /about/global/                   Global network (9 subsidiaries)
│   └── /about/group/{11 affiliates}/
├── /sustainability/                     12 pages
├── /press/                              PR
│   ├── /press/baduk/
│   └── /pr/tv/                          Video library (31 videos)
├── /investors/                          4 pages
├── /contact/                            3 pages
├── /search/
└── /404
\`\`\`

## Legacy paths observed in the crawl

${legacyPaths.map((p) => `- \`${p}\``).join('\n')}

## Redirects

${redirects.length} redirect rules. Full detail in \`audit/redirect-map.csv\`.

| Group | Rules |
| --- | --- |
| Entry point | 1 |
| Preserved paths (trailing slash / rename) | ${PRESERVED.filter((p) => (RENAMED[p] ?? `${p}/`) !== p).length} |
| Product catalogue + categories | ${1 + Object.keys(LEGACY_TAB).length} |
| Product fragments -> product pages | ${products.length} |
| Variant fragments -> anchors | ${products.reduce((n, p) => n + p.variants.length, 0)} |
| Recipe list + pagination | 7 |
| Recipe detail (canonical + paginated duplicates) | ${recipes.length * 8} |
| Removed / consolidated source routes | 5 |

### Integrity checks

- Redirect chains: **${chains.length}** ${chains.length ? `— ${chains.slice(0, 5).map((c) => c.from).join(', ')}` : '(none)'}
- Redirects pointing at a non-existent route: **${danglingTargets.length}** ${danglingTargets.length ? `— ${danglingTargets.slice(0, 5).map((c) => c.to).join(', ')}` : '(none)'}
- Duplicate \`from\` values: **${redirects.length - new Set(redirects.map((r) => r.from)).size}**
`;

  await fs.writeFile('audit/url-map.md', md);

  console.log(`-> ${newRoutes.length} routes, ${redirects.length} redirects`);
  console.log(`   chains: ${chains.length}, dangling: ${danglingTargets.length}, dup-from: ${redirects.length - new Set(redirects.map((r) => r.from)).size}`);
}

main();
