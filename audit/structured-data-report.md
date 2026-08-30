# Structured data report

Generated 2026-08-30 from the built site.

Every page emits **one** JSON-LD block containing a `@graph`, so nodes can
reference each other by `@id` instead of repeating the Organization on every
page.

## Coverage

| Metric | Value |
| --- | --- |
| Pages built | 223 |
| Pages with structured data | 222 (99.6%) |
| Product pages with `Product` | 68 of 68 |
| Recipe pages with `Recipe` | 91 of 101 |

## Types emitted

| Type | Nodes |
| --- | ---: |
| `Organization` | 222 |
| `BreadcrumbList` | 220 |
| `Recipe` | 91 |
| `Product` | 68 |
| `WebPage` | 39 |
| `ItemList` | 14 |
| `CollectionPage` | 13 |
| `ContactPage` | 1 |
| `WebSite` | 1 |

## What is deliberately absent

The source site publishes no commerce or ratings data, so none is emitted.
These properties are asserted **nowhere** on the site, and the SEO audit fails
the build if one appears:

- `Product`: `offers`, `price`, `availability`, `sku`, `gtin`, `aggregateRating`, `review`
- `Recipe`: `aggregateRating`, `review`, `nutrition`, `prepTime`, `cookTime`, `recipeYield`
- `VideoObject`: `uploadDate`, `thumbnailUrl` — the source's date field is a CMS
  record timestamp, not a publication date, and no thumbnail is published

`Recipe` is emitted only where the page carries a name, an image and
instructions; a recipe missing any of those gets `WebPage` alone.

## Consistency

The SEO audit checks, for every page, that:

- each `Product.name` appears in the rendered page body
- each `Recipe` instruction's text appears in the rendered page body
- `BreadcrumbList` positions are sequential from 1
- every `@graph` node has a `@type` and the document has an `@context`

Result at the time of writing: **0 structured-data errors.**
