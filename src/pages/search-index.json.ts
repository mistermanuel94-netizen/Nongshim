/**
 * The search index, emitted as a static JSON endpoint.
 *
 * Keys are single letters to keep the payload small; the file is fetched only
 * when a visitor uses the search box, so it never costs anything on any other
 * page. Content comes from the same models the pages render, so the index can
 * never describe something the site does not have.
 */
import type { APIRoute } from 'astro';
import { products, recipes, categories, character } from '../lib/content';

interface Entry {
  t: string;
  p: string;
  k: string;
  m: string;
}

export const GET: APIRoute = () => {
  const entries: Entry[] = [
    ...products.map((p) => ({
      t: p.name,
      p: p.path,
      k: p.categoryName ?? 'Product',
      m: [p.tagline, p.weight, p.released ? `released ${p.released}` : null, ...p.variants.map((v) => v.name)]
        .filter(Boolean)
        .join(' · '),
    })),
    ...recipes.map((r) => ({
      t: r.name,
      p: r.path,
      k: 'Recipe',
      m: [r.summary, ...r.relatedProducts.map((x) => x.name), ...r.ingredients].filter(Boolean).join(' · '),
    })),
    ...categories.map((c) => ({ t: c.name, p: c.path, k: 'Category', m: c.description })),
    { t: character.name, p: character.path, k: 'Character', m: character.intro },
  ];

  return new Response(JSON.stringify(entries), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
