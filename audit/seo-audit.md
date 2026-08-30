# SEO audit (machine-generated summary)

This file summarises the machine output. The narrative analysis is
`audit/final-seo-audit.md`; the raw result is `audit/seo-audit.json`.

## Command

```bash
npm run seo-audit
```

Crawls `dist/` exactly as a search engine would — starting at `/`, following
only links present in the HTML — and checks every reachable page.

## Result

```
pages crawled       223
indexable           221
in sitemap          221
pages with JSON-LD  222
images              2677
avg HTML            43 KB
max DOM nodes       1038
external scripts    none
orphan pages        0
broken links        0
duplicate groups    0

0 errors, 5 warnings
```

## What it enforces (build fails on any of these)

**Metadata**
- missing or duplicate `<title>` on an indexable page
- missing or duplicate meta description
- missing canonical, or a canonical that does not match the route
- zero or multiple `<h1>`
- missing `<html lang>` or viewport
- a viewport that blocks zoom

**Structure**
- a heading level skipped anywhere in document order
- a duplicate `id`
- a link with no accessible text
- a broken internal link, or an in-page anchor with no matching `id`
- an orphan page unreachable from `/`
- two pages sharing their first 2,000 characters of main content

**Images**
- a missing `alt` attribute
- alt text that is not in the page's language
- an image without intrinsic `width`/`height`

**Structured data**
- JSON-LD that is not valid JSON, or missing `@context`/`@type`
- a `Product` asserting `offers`, `aggregateRating`, `review`, `sku` or `gtin`
- a `Recipe` asserting `aggregateRating`, `review` or `nutrition`
- a `Product.name` that does not appear in the page body
- a `Recipe` instruction whose text does not appear in the page body
- non-sequential `BreadcrumbList` positions

**Sitemap and robots**
- a sitemap entry that is not a built page, or that is `noindex`
- a missing sitemap reference in `robots.txt`
- `robots.txt` disallowing the whole site, or blocking CSS, JS or `/_assets`

## Warnings (do not fail the build)

Five, all thin content on source pages that are document indexes or a form:

```
/investors/audit/       33 words
/investors/report/      44 words
/investors/overview/    55 words
/sustainability/report/ 55 words
/contact/inquiry/       45 words
```

The source genuinely has little prose on these. Each states its own contents in
prose derived from its own data, and section landings list their children with
each child's description. None was padded with filler. See
`audit/content-audit.md`.
