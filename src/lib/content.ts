/**
 * Typed accessors over the generated content in `src/content/`.
 *
 * The JSON is produced by `tools/build-content.mjs` from the extracted public
 * source data. Nothing here fabricates content; every accessor either returns
 * what the source published or returns nothing.
 */
import productsJson from '../content/products.json';
import recipesJson from '../content/recipes.json';
import categoriesJson from '../content/categories.json';
import characterJson from '../content/character.json';
import historyJson from '../content/history.json';
import networkJson from '../content/network.json';
import officesJson from '../content/offices.json';
import videosJson from '../content/videos.json';
import pagesJson from '../content/pages.json';
import type { ContentImage } from './images';

export interface Ref {
  id: string;
  slug: string;
  name: string;
}

export interface ProductVariant {
  prodCode: string;
  slug: string;
  name: string;
  image: ContentImage | null;
  weight: string | null;
  released: string | null;
  certification: string | null;
}

export interface Product {
  id: string;
  slug: string;
  path: string;
  name: string;
  /** Page title; disambiguated when two products share a display name. */
  displayTitle: string;
  tagline: string | null;
  category: string;
  categoryName: string | null;
  categoryPath: string | null;
  featured: boolean;
  cardImage: ContentImage | null;
  heroImage: ContentImage | null;
  weight: string | null;
  released: string | null;
  certification: string | null;
  otherSpecs: Record<string, string>;
  description: string[];
  variants: ProductVariant[];
  relatedProducts: Ref[];
  relatedRecipes: Ref[];
  provenance: Provenance;
}

export interface RecipeStep {
  number: number;
  text: string;
  image: ContentImage | null;
}

export interface Recipe {
  id: string;
  slug: string;
  path: string;
  name: string;
  /** Page title; disambiguated when two recipes share a display name. */
  displayTitle: string;
  annotation: string | null;
  summary: string | null;
  heroImage: ContentImage | null;
  ingredients: string[];
  ingredientsRaw: string | null;
  steps: RecipeStep[];
  relatedProducts: Ref[];
  provenance: Provenance;
}

export interface Category {
  id: string;
  name: string;
  path: string;
  description: string;
}

export interface Provenance {
  sourceUrls: string[];
  sourceChecked: string;
  transformation: string;
}

export interface SectionPage {
  path: string;
  section: string;
  sourceUrl: string;
  heading: string | null;
  /** A description unique to this page; null when the source reuses one. */
  description: string | null;
  /** The source's hero line, which may legitimately repeat across pages. */
  heroDescription: string | null;
  heroImage: ContentImage | null;
  blocks: { tag: string; text: string; table?: number }[];
  tables: { caption: string | null; head: string[]; rows: string[][] }[];
  images: ContentImage[];
  provenance: Provenance;
}

export const products = productsJson as unknown as Product[];
export const recipes = recipesJson as unknown as Recipe[];
export const categories = categoriesJson as unknown as Category[];
export const character = characterJson as unknown as {
  id: string;
  name: string;
  path: string;
  intro: string;
  heroImage: ContentImage | null;
  storyHeading: string;
  storyImage: ContentImage | null;
  story: string[];
  profileHeading: string;
  profileImage: ContentImage | null;
  profile: { label: string; value: string }[];
  galleryHeading: string;
  gallery: ContentImage[];
  provenance: Provenance;
};
export const history = historyJson as unknown as {
  heading: string | null;
  description: string | null;
  heroImage: ContentImage | null;
  years: { year: string; entries: { year: string; month: string | null; caption: string; image: ContentImage | null }[] }[];
  provenance: Provenance;
};
export const network = networkJson as unknown as {
  heading: string | null;
  description: string | null;
  heroImage: ContentImage | null;
  subsidiaries: {
    id: string | null;
    slug: string;
    name: string;
    lead: string | null;
    body: string[];
    images: ContentImage[];
    contact: { address?: string; tel?: string } | null;
    links: { href: string; label: string | null }[];
  }[];
  provenance: Provenance;
};
export const offices = officesJson as unknown as {
  heading: string | null;
  description: string | null;
  heroImage: ContentImage | null;
  offices: {
    id: string | null;
    name: string;
    address: string | null;
    phone: string | null;
    phoneNote: string | null;
    image: ContentImage | null;
    mapEmbed: string | null;
  }[];
  provenance: Provenance;
};
export const videos = videosJson as unknown as {
  heading: string | null;
  description: string | null;
  heroImage: ContentImage | null;
  videos: { id: string; title: string; youtubeId: string; transcript: string[]; publishedAt: string | null }[];
  provenance: Provenance;
};
export const sectionPages = pagesJson as unknown as SectionPage[];

/* ---------------------------------------------------------------- lookups */

const productBySlug = new Map(products.map((p) => [p.slug, p]));
const productById = new Map(products.map((p) => [p.id, p]));
const recipeBySlug = new Map(recipes.map((r) => [r.slug, r]));
const categoryById = new Map(categories.map((c) => [c.id, c]));
const pageByPath = new Map(sectionPages.map((p) => [p.path, p]));

export const getProduct = (slug: string) => productBySlug.get(slug) ?? null;
export const getProductById = (id: string) => productById.get(id) ?? null;
export const getRecipe = (slug: string) => recipeBySlug.get(slug) ?? null;
export const getCategory = (id: string) => categoryById.get(id) ?? null;
export const getSectionPage = (path: string) => pageByPath.get(path) ?? null;

export const productsInCategory = (categoryId: string) =>
  products.filter((p) => p.category === categoryId).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));

export const recipesForProduct = (productId: string) =>
  recipes.filter((r) => r.relatedProducts.some((p) => p.id === productId));

/** Products the catalogue leads with — the source marks these as large cards. */
export const featuredProducts = products.filter((p) => p.featured);

export { RECIPES_PER_PAGE } from '../config/routes.mjs';
