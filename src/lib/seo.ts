/**
 * SEO helpers: canonical URLs, title composition, and JSON-LD builders.
 *
 * Rules enforced here:
 *  - a canonical URL is absolute, trailing-slashed and derived from SITE_URL
 *  - a title is never the bare brand name and never exceeds a sensible length
 *  - structured data only ever asserts properties the page actually shows
 */
import { SITE, SITE_URL, ORGANIZATION } from '../config/site';
import type { Product, Recipe } from './content';

/** Absolute, canonical form of a site-relative path. */
export function canonical(path: string): string {
  const p = path.startsWith('http') ? new URL(path).pathname : path;
  const normalised = p === '/' ? '/' : `${p.replace(/\/+$/, '')}/`;
  return new URL(normalised, SITE_URL).toString();
}

export function absolute(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.startsWith('http') ? path : new URL(path, SITE_URL).toString();
}

/**
 * Compose a page title. Pages supply their own subject; the brand suffix is
 * appended only when it is not already present, so titles never read
 * "Nongshim | Nongshim".
 */
export function pageTitle(subject: string | null | undefined): string {
  const s = (subject ?? '').trim();
  if (!s) return SITE.defaultTitle;
  if (new RegExp(`\\b${SITE.titleSuffix}\\b`, 'i').test(s)) return s;
  return `${s} | ${SITE.titleSuffix}`;
}

/** JSON-LD @id values, so nodes across the site reference one Organization. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: ORGANIZATION.name,
    legalName: ORGANIZATION.legalName,
    url: canonical('/'),
    logo: {
      '@type': 'ImageObject',
      url: absolute(ORGANIZATION.logo),
    },
    foundingDate: ORGANIZATION.foundingDate,
    address: {
      '@type': 'PostalAddress',
      streetAddress: ORGANIZATION.address.streetAddress,
      addressLocality: ORGANIZATION.address.addressLocality,
      addressCountry: ORGANIZATION.address.addressCountry,
    },
    telephone: ORGANIZATION.telephone,
    sameAs: [...ORGANIZATION.sameAs],
  };
}

export function websiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: canonical('/'),
    name: SITE.name,
    inLanguage: SITE.locale,
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${canonical('/search')}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: canonical(c.path),
    })),
  };
}

/**
 * Product schema.
 *
 * The public source publishes a name, description, image, net weight, release
 * date and (for some products) a HALAL certification. It publishes no price,
 * no availability, no GTIN, no reviews and no ratings — so none are emitted.
 * `offers`, `aggregateRating` and `review` are deliberately absent; adding them
 * would be fabricated data and a structured-data policy violation.
 */
export function productSchema(product: Product, imageUrls: string[]) {
  const additionalProperty: Record<string, unknown>[] = [];
  if (product.weight) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Net weight', value: product.weight });
  }
  if (product.released) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Released', value: product.released });
  }
  if (product.certification) {
    additionalProperty.push({ '@type': 'PropertyValue', name: 'Certification', value: product.certification });
  }

  const node: Record<string, unknown> = {
    '@type': 'Product',
    '@id': `${canonical(product.path)}#product`,
    name: product.name,
    url: canonical(product.path),
    brand: { '@id': ORG_ID },
    manufacturer: { '@id': ORG_ID },
  };

  if (product.description.length) node.description = product.description.join(' ');
  else if (product.tagline) node.description = product.tagline;
  if (imageUrls.length) node.image = imageUrls;
  if (product.categoryName) node.category = product.categoryName;
  if (product.weight) node.weight = product.weight;
  if (additionalProperty.length) node.additionalProperty = additionalProperty;
  if (product.variants.length > 1) {
    node.hasVariant = product.variants.map((v) => {
      const variant: Record<string, unknown> = {
        '@type': 'Product',
        name: v.name,
        url: `${canonical(product.path)}#${v.slug}`,
      };
      if (v.weight) variant.weight = v.weight;
      return variant;
    });
  }
  return node;
}

/**
 * Recipe schema.
 *
 * Emitted only when the page carries the properties Google requires for a
 * recipe rich result: a name, an image and instructions. Ingredients are
 * included when the source lists them. The source publishes no yield, no prep
 * or cook time, no nutrition and no ratings, so those fields are omitted rather
 * than guessed.
 */
export function recipeSchema(recipe: Recipe, heroUrl: string | undefined, stepImages: (string | undefined)[]) {
  if (!heroUrl || !recipe.steps.length) return null;

  const node: Record<string, unknown> = {
    '@type': 'Recipe',
    '@id': `${canonical(recipe.path)}#recipe`,
    name: recipe.name,
    url: canonical(recipe.path),
    image: [heroUrl],
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    inLanguage: SITE.locale,
    recipeInstructions: recipe.steps.map((s, i) => {
      const step: Record<string, unknown> = {
        '@type': 'HowToStep',
        position: s.number,
        text: s.text,
        url: `${canonical(recipe.path)}#step-${s.number}`,
      };
      const img = stepImages[i];
      if (img) step.image = img;
      return step;
    }),
  };

  if (recipe.summary) node.description = recipe.summary;
  if (recipe.ingredients.length) node.recipeIngredient = recipe.ingredients;
  return node;
}

/** ItemList for a listing page, so the set is machine-readable as a set. */
export function itemListSchema(items: { name: string; path: string }[], name: string) {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: canonical(item.path),
    })),
  };
}

/** Wrap nodes into one @graph so the page emits a single JSON-LD block. */
export function graph(nodes: (Record<string, unknown> | null | undefined)[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}
