/**
 * Content model tests.
 *
 * These assert the invariants the site's correctness depends on — that the
 * catalogue is complete, that relationships resolve, that URLs are unique and
 * that no structured-data policy is violated. They run against the generated
 * content, so a bad extraction fails the test suite rather than the audit.
 */
import { describe, expect, it } from 'vitest';
import products from '../src/content/products.json';
import recipes from '../src/content/recipes.json';
import categories from '../src/content/categories.json';
import character from '../src/content/character.json';
import routes from '../data/routes.json';
import redirects from '../data/redirects.json';

/** Counts verified against the public source during the Phase 1 crawl. */
const EXPECTED_PRODUCTS = 68;
const EXPECTED_RECIPES = 101;
const EXPECTED_CATEGORIES = 4;

describe('product catalogue', () => {
  it('contains every product published on the source site', () => {
    expect(products).toHaveLength(EXPECTED_PRODUCTS);
  });

  it('assigns every product to one of the four published categories', () => {
    const ids = new Set(categories.map((c) => c.id));
    expect(ids.size).toBe(EXPECTED_CATEGORIES);
    for (const p of products) {
      expect(ids, `${p.slug} has category "${p.category}"`).toContain(p.category);
    }
  });

  it('gives every product a unique slug and path', () => {
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length);
    expect(new Set(products.map((p) => p.path)).size).toBe(products.length);
  });

  it('gives every product a unique page title', () => {
    const titles = products.map((p) => p.displayTitle);
    expect(new Set(titles).size, `duplicates: ${titles.filter((t, i) => titles.indexOf(t) !== i)}`).toBe(
      titles.length
    );
  });

  it('never lets a product slug collide with a category path', () => {
    const categorySlugs = new Set(categories.map((c) => c.path.replace(/^\/products\/|\/$/g, '')));
    for (const p of products) expect(categorySlugs).not.toContain(p.slug);
  });

  it('gives every variant a unique anchor within its product', () => {
    for (const p of products) {
      const slugs = p.variants.map((v) => v.slug);
      expect(new Set(slugs).size, `${p.slug} variants: ${slugs}`).toBe(slugs.length);
    }
  });

  it('resolves every related-product reference', () => {
    const ids = new Set(products.map((p) => p.id));
    for (const p of products) for (const r of p.relatedProducts) expect(ids).toContain(r.id);
  });

  it('carries source provenance on every product', () => {
    for (const p of products) {
      expect(p.provenance.sourceUrls.length).toBeGreaterThan(0);
      expect(p.provenance.sourceChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.provenance.transformation).toBeTruthy();
    }
  });

  it('publishes no commerce data the source does not have', () => {
    // Guards the Product schema policy at the data layer: if a price or rating
    // ever appears in the content model, it came from somewhere invented.
    for (const p of products) {
      for (const key of ['price', 'offers', 'rating', 'aggregateRating', 'availability', 'sku', 'gtin']) {
        expect(p, `${p.slug} has ${key}`).not.toHaveProperty(key);
      }
    }
  });
});

describe('recipes', () => {
  it('contains every recipe published on the source site', () => {
    expect(recipes).toHaveLength(EXPECTED_RECIPES);
  });

  it('gives every recipe a unique slug, path and title', () => {
    expect(new Set(recipes.map((r) => r.slug)).size).toBe(recipes.length);
    expect(new Set(recipes.map((r) => r.path)).size).toBe(recipes.length);
    expect(new Set(recipes.map((r) => r.displayTitle)).size).toBe(recipes.length);
  });

  it('gives every recipe at least one instruction step', () => {
    for (const r of recipes) expect(r.steps.length, r.slug).toBeGreaterThan(0);
  });

  it('numbers steps consecutively from one', () => {
    for (const r of recipes) {
      expect(r.steps.map((s) => s.number)).toEqual(r.steps.map((_, i) => i + 1));
    }
  });

  it('resolves every product a recipe references', () => {
    const ids = new Set(products.map((p) => p.id));
    for (const r of recipes) for (const p of r.relatedProducts) expect(ids, r.slug).toContain(p.id);
  });

  it('only claims a product link when the recipe names that product', () => {
    // The relationship is evidence-based; the product name must appear in the
    // recipe's own ingredient text or title.
    for (const r of recipes) {
      const haystack = `${r.ingredientsRaw ?? ''} ${r.name}`.toLowerCase();
      for (const ref of r.relatedProducts) {
        const product = products.find((p) => p.id === ref.id)!;
        const names = [product.name, ...product.variants.map((v) => v.name)].map((n) =>
          n.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
        );
        const normalised = ` ${haystack.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `;
        expect(
          names.some((n) => normalised.includes(` ${n} `)),
          `${r.slug} claims ${product.name} but does not name it`
        ).toBe(true);
      }
    }
  });
});

describe('SHIN character', () => {
  it('publishes the profile the source page shows', () => {
    const labels = character.profile.map((p) => p.label);
    expect(labels).toEqual(
      expect.arrayContaining(['Name', 'Dream', 'Hobby', 'Likes', 'Personality', 'Features', 'Strength', 'Weakness'])
    );
  });

  it('publishes the character story and gallery', () => {
    expect(character.story.length).toBeGreaterThan(0);
    expect(character.gallery.length).toBeGreaterThan(0);
  });

  it('contains no Korean text on the English site', () => {
    const text = JSON.stringify(character);
    expect(text).not.toMatch(/[ㄱ-ㆎ가-힣]/);
  });
});

describe('routing', () => {
  it('has no duplicate routes', () => {
    expect(new Set(routes.map((r) => r.path)).size).toBe(routes.length);
  });

  it('routes every product and recipe', () => {
    const paths = new Set(routes.map((r) => r.path));
    for (const p of products) expect(paths).toContain(p.path);
    for (const r of recipes) expect(paths).toContain(r.path);
  });

  it('has no duplicate redirect sources', () => {
    const froms = redirects.map((r) => r.from);
    expect(new Set(froms).size).toBe(froms.length);
  });

  it('points every redirect at a real route', () => {
    const paths = new Set(routes.map((r) => r.path));
    for (const r of redirects) expect(paths, `${r.from} -> ${r.to}`).toContain(r.to.split('#')[0]);
  });

  it('has no redirect chains', () => {
    const froms = new Set(redirects.map((r) => r.from.split('?')[0]));
    for (const r of redirects) {
      expect(froms, `${r.from} -> ${r.to} is a chain`).not.toContain(r.to.split('#')[0]);
    }
  });

  it('gives every redirect a stated reason', () => {
    for (const r of redirects) expect(r.reason, r.from).toBeTruthy();
  });

  it('maps every legacy recipe URL form', () => {
    // The source exposed each recipe at `?recipeId=N` and at
    // `?page=P&recipeId=N`; both must resolve.
    for (const r of recipes) {
      expect(redirects.some((x) => x.from === `/recipe/recipe_view?recipeId=${r.id}`), r.id).toBe(true);
      expect(redirects.some((x) => x.from === `/recipe/recipe_view?page=1&recipeId=${r.id}`), r.id).toBe(true);
    }
  });

  it('maps every legacy product fragment URL', () => {
    for (const p of products) {
      expect(redirects.some((x) => x.from === `/brand/main/container?brandId=${p.id}`), p.id).toBe(true);
      for (const v of p.variants) {
        expect(redirects.some((x) => x.from === `/brand/main/detail?prodCode=${v.prodCode}`), v.prodCode).toBe(true);
      }
    }
  });
});

describe('trailing slashes', () => {
  it('ends every internal path with a slash', () => {
    for (const r of routes) {
      if (r.path.endsWith('.html')) continue;
      expect(r.path, r.path).toMatch(/\/$/);
    }
  });
});
