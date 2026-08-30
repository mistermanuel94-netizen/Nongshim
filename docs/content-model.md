# Content model

## Two directories, one direction of flow

```
data/           what the source published        (tools/extract*.mjs)
   ↓            tools/build-content.mjs
src/content/    what this site renders
   ↓            src/lib/content.ts
pages
```

`data/` is a faithful record of the public source: every field is either present
on `eng.nongshim.com` or absent here. `src/content/` is the render-ready shape:
assets resolved to local files, alt text written, relationships materialised,
paths assigned.

Keeping them separate means re-crawling never disturbs the site, and rebuilding
the site never re-hits the network.

## Entities

### Product — 68 records

```ts
interface Product {
  id: string;              // the source's brandId, e.g. "shinramyun"
  slug: string;            // "shin-ramyun"
  path: string;            // "/products/shin-ramyun/"
  name: string;            // "Shin Ramyun"
  displayTitle: string;    // name, disambiguated if two products share one
  tagline: string | null;  // the source's "kinds" line
  category: string;        // "instant-noodles"
  categoryName: string | null;
  categoryPath: string | null;
  featured: boolean;       // the source's large "best product" card treatment
  cardImage: ContentImage | null;
  heroImage: ContentImage | null;
  weight: string | null;        // "120g"
  released: string | null;      // "1986.10"
  certification: string | null; // "HALAL"
  otherSpecs: Record<string, string>;
  description: string[];        // the source's own paragraphs, verbatim
  variants: ProductVariant[];   // pack formats
  relatedProducts: Ref[];
  relatedRecipes: Ref[];
  provenance: Provenance;
}
```

**What is deliberately absent:** price, availability, SKU, GTIN, ingredients,
nutrition, allergens, ratings, reviews. The source publishes none of them.
`tests/content.test.ts` asserts that no product record has any of those keys, so
a future extraction cannot introduce one silently.

### ProductVariant — 140 records

A pack format: `Shin Ramyun`, `Shin Ramyun Big Bowl`, `Shin Ramyun Cup`. Each
came from a distinct `/brand/main/detail?prodCode=` fragment and has its own
weight, release date and packshot.

Variants are anchors on the product page (`/products/shin-ramyun/#shin-ramyun-cup`)
rather than separate pages: they share a description and a category, so separate
URLs would be near-duplicates competing with each other. The legacy `prodCode`
URLs 301 to those anchors.

### Recipe — 101 records

```ts
interface Recipe {
  id: string;                 // the source's recipeId
  slug: string;
  path: string;
  name: string;
  displayTitle: string;
  annotation: string | null;  // competition metadata recovered from the title
  summary: string | null;     // the source's "Neat explanation"
  heroImage: ContentImage | null;
  ingredients: string[];      // split from the source's free-text list
  ingredientsRaw: string | null;
  steps: RecipeStep[];        // { number, text, image }
  relatedProducts: Ref[];
  provenance: Provenance;
}
```

All 101 recipes have ingredients and steps. 612 steps total, 407 with a
photograph.

### Category — 4 records

The four the source exposes as tabs: Instant Noodles (38), Snacks (24),
Beverages (3), Home Meal Replacement (3). Descriptions are written from the
products the category actually contains.

### Character — 1 record

SHIN: introduction, five story panels, an eight-field profile, and 39
illustrations. Extracted from a `display:none` modal that had no URL.

### Company content

| Model | Records | From |
| --- | ---: | --- |
| `history` | 83 entries across 39 years (1965–2020) | `/about/history` |
| `network` | 9 subsidiaries with descriptions, addresses, phone numbers | `/about/globalNongshim` |
| `offices` | 7 offices with addresses, phone numbers, map embeds | `/contact/location` |
| `videos` | 31 films with published English transcripts | `/pr/ajax.indexList` |
| `pages` | 42 section pages as ordered content blocks and tables | crawl |

### ContentImage

```ts
interface ContentImage {
  file: string;        // local filename in src/assets/source/
  width: number | null;
  height: number | null;
  alt: string;         // written by tools/build-content.mjs
  sourceUrl: string;   // the URL it came from
}
```

Present only when the source actually served bytes. `tools/build-content.mjs`
drops any asset that 404'd, 403'd, or returned HTTP 200 with a zero-byte body —
37 assets in total — so a broken `<img>` cannot reach a page. Callers fall back
in a defined order (product card → packshot → variant; recipe hero → step photo)
and render a real empty state when nothing is available.

## Relationships

| Relationship | How it is derived |
| --- | --- |
| Product → category | The catalogue tab the product appears under |
| Product → related products | Same category, nearest by release date, capped at four |
| Product → recipes | Inverse of the recipe → product link |
| Recipe → products | **Evidence-based:** the product's name (or a variant's) appears as a whole phrase in the recipe's own published ingredient list or title |
| Recipe → related recipes | Recipes sharing a product |
| Section landing → children | Pages in the same section |

The recipe → product matcher excludes generic noodle nouns — "udon", "soba",
"ramyun", "noodle", "water" — because those match ordinary ingredient text and
would assert relationships that do not exist. It matches longest names first, so
*Shin Ramyun Black* wins over *Shin Ramyun*. 41 of 101 recipes name a catalogue
product; the rest are older competition entries referring to discontinued lines,
and are linked through the index and their siblings instead.

`tests/content.test.ts` re-derives every asserted relationship from the source
text, so the matcher cannot drift.

## Provenance

Every record carries:

```json
{
  "sourceUrls": ["https://eng.nongshim.com/brand/main/container?brandId=shinramyun"],
  "sourceChecked": "2026-08-30",
  "transformation": "structure-only: AJAX fragments normalised to JSON; asset URLs https-normalised; no copy rewritten"
}
```

This is development metadata and is not rendered. See `docs/source-provenance.md`
for the classification of every transformation.

## Identity and collisions

Slugs come from the display name. Where two distinct entities share a name, they
are **not merged** — the source publishes them as different things — and the
slug gains a deterministic discriminator drawn from published data:

| Collision | Slugs |
| --- | --- |
| Two products named *Champong Noodle Soup* (1992 and 2015) | `champong-noodle-soup-1992`, `champong-noodle-soup-2015` |
| Two recipes named *Tray Doongji Cold Noodle* | `tray-doongji-cold-noodle-6`, `tray-doongji-cold-noodle-119` |
| Two *Onion Rings* variants on one product page | anchors disambiguated by `prodCode` |

Sorting happens before assignment, so the discriminator is stable across runs.

## Validation

`npm run validate-content` runs before every build and **fails it** on:

- duplicate product or recipe slugs, paths or IDs
- a product slug colliding with a category path under `/products/`
- a product with no category, or with neither a description nor a tagline
- an image record pointing at a file that is not on disk
- an image with empty alt text
- a relationship referencing an unknown entity
- a recipe with no steps
- a duplicate redirect source, a redirect chain, or a redirect targeting a
  non-existent route
- an empty character profile, history, network, office or video collection

Warnings — currently 34 — record genuine gaps in the source (a recipe whose
photographs the CDN cannot serve) and do not fail the build. They are listed in
`audit/content-audit.md`.

## Refreshing

```bash
npm run refresh   # crawl -> extract -> assets -> ia + build-content
npm run build
```

Each stage is idempotent and disk-cached, so an unchanged source page is not
re-fetched. If the catalogue grows, the new products appear with routes,
redirects, relationships and sitemap entries without any code change.
