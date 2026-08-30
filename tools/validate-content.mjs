/**
 * Content integrity gate. Runs before the build; a failure stops the build.
 *
 * Checks the invariants that would otherwise become silent production defects:
 * duplicate slugs, colliding route namespaces, missing metadata inputs, broken
 * relationships, and images referenced but not present on disk.
 *
 * Exit code 1 on any error. Warnings are reported but do not fail the build —
 * they record genuine gaps in the public source, not defects in this project.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const read = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));

function checkUnique(items, key, label) {
  const seen = new Map();
  for (const item of items) {
    const value = item[key];
    if (seen.has(value)) fail(`Duplicate ${label} ${key} "${value}" (${seen.get(value)} and ${item.id})`);
    else seen.set(value, item.id);
  }
}

async function main() {
  const [products, recipes, categories, character, history, network, offices, videos, pages, routes, redirects] =
    await Promise.all([
      read('src/content/products.json'),
      read('src/content/recipes.json'),
      read('src/content/categories.json'),
      read('src/content/character.json'),
      read('src/content/history.json'),
      read('src/content/network.json'),
      read('src/content/offices.json'),
      read('src/content/videos.json'),
      read('src/content/pages.json'),
      read('data/routes.json'),
      read('data/redirects.json'),
    ]);

  const assetFiles = new Set(await fs.readdir('src/assets/source'));

  /* ---- uniqueness ---- */
  checkUnique(products, 'slug', 'product');
  checkUnique(recipes, 'slug', 'recipe');
  checkUnique(products, 'id', 'product');
  checkUnique(recipes, 'id', 'recipe');

  /* ---- route namespace ---- */
  const categorySlugs = new Set(categories.map((c) => c.path.replace(/^\/products\/|\/$/g, '')));
  for (const p of products) {
    if (categorySlugs.has(p.slug)) {
      fail(`Product slug "${p.slug}" collides with a category path under /products/`);
    }
  }

  const routePaths = new Set(routes.map((r) => r.path));
  if (routePaths.size !== routes.length) fail('data/routes.json contains duplicate paths');

  /* ---- redirects ---- */
  const redirectFroms = new Set();
  for (const r of redirects) {
    if (redirectFroms.has(r.from)) fail(`Duplicate redirect source: ${r.from}`);
    redirectFroms.add(r.from);
    const target = r.to.split('#')[0];
    if (!routePaths.has(target)) fail(`Redirect ${r.from} points at ${target}, which is not a built route`);
    if (redirectFroms.has(target) || redirects.some((o) => o.from === target)) {
      fail(`Redirect chain: ${r.from} -> ${target}, which is itself redirected`);
    }
    if (!r.reason) fail(`Redirect ${r.from} has no stated reason`);
  }

  /* ---- products ---- */
  for (const p of products) {
    if (!p.name) fail(`Product ${p.id} has no name`);
    if (!p.category || p.category === 'uncategorised') fail(`Product ${p.slug} has no category`);
    if (!p.categoryPath) fail(`Product ${p.slug} has no category path`);
    if (!p.description.length && !p.tagline) {
      fail(`Product ${p.slug} has neither a description nor a tagline — no meta description can be composed`);
    }
    if (!p.cardImage) warn(`Product ${p.slug} has no usable card image (source asset missing)`);
    for (const img of [p.cardImage, p.heroImage, ...p.variants.map((v) => v.image)]) {
      if (img && !assetFiles.has(img.file)) fail(`Product ${p.slug} references missing asset file ${img.file}`);
      if (img && !img.alt) fail(`Product ${p.slug} has an image with empty alt text (${img.file})`);
    }
    for (const rel of p.relatedRecipes) {
      if (!recipes.some((r) => r.id === rel.id)) fail(`Product ${p.slug} links to unknown recipe ${rel.id}`);
    }
    for (const rel of p.relatedProducts) {
      if (!products.some((o) => o.id === rel.id)) fail(`Product ${p.slug} links to unknown product ${rel.id}`);
    }
  }

  /* ---- recipes ---- */
  for (const r of recipes) {
    if (!r.name) fail(`Recipe ${r.id} has no name`);
    if (!r.steps.length) fail(`Recipe ${r.slug} has no steps`);
    if (!r.heroImage) warn(`Recipe ${r.slug} has no usable image (source assets missing)`);
    for (const img of [r.heroImage, ...r.steps.map((s) => s.image)]) {
      if (img && !assetFiles.has(img.file)) fail(`Recipe ${r.slug} references missing asset file ${img.file}`);
      if (img && !img.alt) fail(`Recipe ${r.slug} has an image with empty alt text (${img.file})`);
    }
    for (const rel of r.relatedProducts) {
      if (!products.some((p) => p.id === rel.id)) fail(`Recipe ${r.slug} links to unknown product ${rel.id}`);
    }
    const missingStepImages = r.steps.filter((s) => !s.image).length;
    if (missingStepImages === r.steps.length && r.steps.length > 2) {
      warn(`Recipe ${r.slug} has no step photography (source assets missing)`);
    }
  }

  /* ---- section pages ---- */
  for (const p of pages) {
    if (!p.heading) warn(`Section page ${p.path} has no heading`);
    if (!p.blocks.length) warn(`Section page ${p.path} has no content blocks`);
  }

  /* ---- singletons ---- */
  if (!character?.profile?.length) fail('Character profile is empty');
  if (!character?.story?.length) fail('Character story is empty');
  if (!history?.years?.length) fail('History timeline is empty');
  if (!network?.subsidiaries?.length) fail('Global network is empty');
  if (!offices?.offices?.length) fail('Office list is empty');
  if (!videos?.videos?.length) fail('Video library is empty');

  /* ---- orphan check ---- */
  const linkedProducts = new Set(products.map((p) => p.id));
  for (const p of products) {
    if (!p.categoryPath) fail(`Product ${p.slug} is orphaned — no category page links to it`);
    linkedProducts.delete(p.id);
  }

  /* ---- report ---- */
  for (const w of warnings) console.log(`  warn  ${w}`);
  for (const e of errors) console.error(`  ERROR ${e}`);

  console.log(
    `\ncontent validation: ${products.length} products, ${recipes.length} recipes, ${pages.length} section pages, ` +
      `${routes.length} routes, ${redirects.length} redirects`
  );
  console.log(`  ${errors.length} errors, ${warnings.length} warnings`);

  if (errors.length) {
    console.error('\nBuild blocked: fix the errors above.');
    process.exit(1);
  }
}

main();
