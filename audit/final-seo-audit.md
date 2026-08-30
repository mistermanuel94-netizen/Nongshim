# Final SEO / AEO / GEO audit

Source crawled 2026-08-30. Rebuild measured against `dist/` on the same date.
Every figure is produced by tooling in `tools/`; none is estimated.

## Before and after

| Signal | Source (279 URLs crawled) | Rebuild (223 pages) |
| --- | --- | --- |
| Distinct `<title>` values | **3** across 261 reachable pages — `GLOBAL NONGSHIM` on 259 of them | **223** — every page unique |
| Pages with a meta description | 15 | **223** |
| Pages with a canonical | **0** | **223** |
| Pages with a descriptive `<h1>` | 0 (the logo was the `<h1>`) | **223** |
| Pages with Open Graph | **0** | **223** |
| Pages with JSON-LD | **0** | **222** (the 404 is excluded) |
| `robots.txt` | HTTP 404 | Present, with the sitemap |
| XML sitemap | HTTP 404 | 221 canonical URLs |
| Crawlable product URLs | **0** | 68 products + 4 categories |
| Recipe URLs | 2 forms each, no canonical | 1 canonical each |
| Internal 404s | 11 | **0** |
| Malformed outbound links | 21 (`http:/host`, resolve as same-origin 404s) | 0 |
| Content images that could carry alt text | 1,690 of 8,667 — the other 6,977 were CSS `background-image` declarations, which cannot have alt | 2,677 of 2,677 |
| Of those, images actually carrying alt | 1,580 of 1,690 | 2,677 of 2,677 |
| CSS shipped per page | ~2.36 MB | ~4 KB (inlined) |
| Third-party scripts | GTM, Naver, Font Awesome CDN | **0** |

## Technical SEO

| Check | Result |
| --- | --- |
| Unique titles | 223/223 |
| Unique meta descriptions | 223/223 |
| Canonical present and correct | 223/223 (recomputed and compared per route) |
| Exactly one `<h1>` | 223/223 |
| Heading order without a skipped level | 223/223 |
| `<html lang>` | 223/223 |
| Viewport permits zoom | 223/223 |
| Open Graph + Twitter card | 223/223 |
| Broken internal links | **0** |
| Orphan pages | **0** |
| Duplicate content groups | **0** |
| Redirect chains | **0** |
| Sitemap ↔ built-page agreement | Exact, both directions |
| Crawl traps | None — no crawlable query-parameter URL exists |
| Maximum crawl depth from `/` | **3** |

Command: `npm run seo-audit` → **0 errors, 5 warnings**.

The five warnings are thin content on source pages that are document indexes or
a form (`/investors/audit/`, `/investors/report/`, `/investors/overview/`,
`/sustainability/report/`, `/contact/inquiry/`). Each states its own contents in
prose derived from its data; none was padded with filler. See
`audit/content-audit.md`.

## On-page SEO

**Titles.** Template per page type, brand appended only when not already
present. Two name collisions in the source catalogue are disambiguated with
published facts rather than merged — see `docs/seo.md`.

**Descriptions.** Composed only from published copy. A hero line reused across
several source pages is discarded rather than repeated, because text shared
between pages describes none of them. Long descriptions are trimmed at a
sentence boundary; short ones are extended with more published facts.

**Content depth.** Product pages carry the product's own description, a
specification table, every pack format with its weight and release date, related
recipes and related products. Recipe pages carry the summary, the full
ingredient list and every photographed step. No page was inflated to hit a word
count.

## Image SEO

| Metric | Value |
| --- | --- |
| Images in the built site | 2,677 |
| With alt text | 2,677 |
| With intrinsic width and height | 2,677 |
| Non-English alt text | 0 |
| Alt text over 180 characters | 0 |
| Lazy-loaded below the fold | All but the LCP element |
| `fetchpriority="high"` per page | Exactly 1 |

On the source, 6,977 of 8,667 content images were CSS `background-image`
declarations — no alt, no dimensions, no `srcset`, no participation in image
search. All content imagery is now `<img>`.

## Structured data

`audit/structured-data-report.md`. 222 pages, one `@graph` each.

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

**`Recipe` is emitted on 91 of 101 recipe pages, not all of them.** Google
requires a name, an image and instructions for a recipe rich result; the ten
recipes whose photographs the source CDN serves as zero bytes have no image, so
those pages get `WebPage` alone. Emitting `Recipe` without an image would be an
invalid claim, and pointing it at a substitute photograph would be a fabricated
one. The ten resolve automatically if Nongshim repairs the assets.

Consistency is enforced, not assumed: every `Product.name` and every `Recipe`
instruction in the structured data is verified to appear in the rendered page
body, and the build fails otherwise.

**Deliberately absent** because the source publishes none of it: `offers`,
`price`, `availability`, `sku`, `gtin`, `aggregateRating`, `review`, `nutrition`,
`prepTime`, `cookTime`, `recipeYield`, `uploadDate`. The audit fails the build
if any appears.

## Entity architecture

One `Organization` node, defined once at `{SITE_URL}/#organization` and
referenced by `@id` from every other node — so `Product.brand`,
`Product.manufacturer`, `Recipe.author`, `Recipe.publisher`, `WebSite.publisher`
and every subsidiary's `parentOrganization` all resolve to the same entity
rather than to 222 separate assertions.

`sameAs` lists exactly the six social profiles the source site links to. No
identifier was added from outside the source.

Naming is consistent across the `<h1>`, `<title>`, breadcrumb, link anchors and
JSON-LD `name` for every entity, so an extractor sees one string per thing.

## AEO — answer extraction

Ten questions and the page that answers each in its initial HTML are tabulated
in `docs/aeo-geo.md`. The structural properties that make them extractable:

- The subject is the `<h1>`; the answer is the first paragraph after it
- Attribute–value facts are `<dl>` or `<table>` with `<th scope>`, not prose
- Text that the source rendered as images (the "SHIN" wordmark inside sentences)
is now text
- Nothing important is behind interaction: `<details>` keeps its content in the
  DOM, unlike the source's JavaScript modals
- 31 video transcripts are published as text
- Pages state their own scope with computed counts ("68 products", "101
  recipes", "9 overseas subsidiaries")

## GEO — retrieval and synthesis

| Property | How it is achieved |
| --- | --- |
| Factual clarity | Every fact is published by Nongshim; nothing is inferred |
| Source consistency | Machine-readable and human-readable versions of a page are verified identical |
| Entity clarity | One `@id` per entity, referenced everywhere |
| Topical completeness | The complete catalogue and recipe library, not a subset |
| Internal linking | Depth 3, zero orphans, descriptive anchors |
| Stable URLs | Slug-based, permanent, with 1,074 redirects covering the legacy space |
| Clean HTML | No third-party script; content is in the initial response |

## AI crawler accessibility

`robots.txt` permits GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
Claude-User, PerplexityBot, Google-Extended, Applebot-Extended, CCBot and
meta-externalagent, each with `/search/` disallowed. Rationale and reversal
instructions: `docs/aeo-geo.md`.

Nothing on the site requires JavaScript execution to read. Every fact in this
report is present in `curl` output.

## Core Web Vitals

Median of three Lighthouse runs, mobile with 4× CPU throttling and Slow 4G:

| Metric | Range | Threshold |
| --- | --- | --- |
| LCP | 1.58 – 2.41 s | < 2.5 s |
| CLS | **0.000** everywhere | < 0.1 |
| TBT | 0 – 122 ms | < 200 ms |

| Lighthouse category | Mobile | Desktop |
| --- | --- | --- |
| Performance | 96–100 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 96–100 | 96–100 |
| SEO | **100** | **100** |

## Accessibility

`npm run a11y-audit`: **0 violations** across 223 pages and 18 colour pairings.
`npm run browser-test`: 9 checks pass, including no horizontal overflow across
130 page/width combinations and reflow at a 320 px equivalent viewport.
Details: `docs/accessibility.md`, `audit/browser-report.md`.

## Indexability

| Class | Pages | Directive |
| --- | ---: | --- |
| Indexable | 221 | `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` |
| Deliberately excluded | 2 | `/search/` and `/404.html` — `noindex, follow` |

`max-image-preview:large` matters for a food brand: it permits full-size image
thumbnails in results and in AI surfaces.

## Residual risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Cloudflare Pages `_redirects` ignores query strings, so ~1,000 legacy URLs would 404 there | **High if deployed to Pages without the extra step** | `deploy/redirects.csv` for Bulk Redirects; the generated file says so at the point of the gap. See `docs/redirects.md` |
| `SITE_URL` wrong at build time would produce wrong canonicals site-wide | High | Verification command in `docs/deployment.md`; check before the first deploy |
| 10 recipes have no usable image because the source CDN serves zero bytes | Medium | Typographic cards; resolves automatically when Nongshim fixes the assets |
| Two duplicate entity names in the source catalogue | Low | Disambiguated from published data; Nongshim should rename one of each pair |
| Some packshots are only 600 px wide | Low | Used at native size; upscaling would invent pixels |
| Untranslated Korean on four source pages | Low | Omitted; Nongshim should supply translations |
