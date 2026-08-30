# Architecture

## What this project is

A clean-room rebuild of the public English Nongshim site (`eng.nongshim.com`) as
a static Astro application. The repository started empty; nothing was inherited
from the source implementation. Every piece of content comes from the public
source site and is traceable to the URL it came from.

## The shape of it

```
tools/          Build-time pipeline and audit tooling (Node, never shipped)
data/           Raw extraction from the source site + generated route tables
src/assets/     Source imagery, re-hosted so Astro can optimise it
src/content/    Content models the site renders (generated from data/)
src/            The site itself
audit/          Generated audit artefacts
deploy/         Generated host configuration
docs/           This documentation
```

The separation between `data/` and `src/content/` matters: `data/` is *what the
source published*, `src/content/` is *what this site renders*. The step between
them (`tools/build-content.mjs`) is where asset availability is resolved, alt
text is written and relationships are materialised. Re-running extraction never
touches the site; re-running the content build never touches the extraction.

## The pipeline

```
  eng.nongshim.com
        │
        ▼  tools/crawl.mjs            link-following crawl + the three AJAX
        │                             endpoints that hide the catalogue
  audit/site-inventory.json
        │
        ▼  tools/extract.mjs          products, variants, recipes, SHIN,
        │  tools/extract-company.mjs  history, network, offices, videos
  data/*.json
        │
        ▼  tools/assets.mjs           download every referenced image,
        │                             probe dimensions, record usage
  src/assets/source/ + data/assets.json
        │
        ▼  tools/ia.mjs               route table + redirect map
  data/routes.json, data/redirects.json
        │
        ▼  tools/build-content.mjs    resolve assets, write alt text,
        │                             materialise relationships
  src/content/*.json
        │
        ▼  tools/validate-content.mjs GATE — build stops on any integrity error
        │
        ▼  astro build                223 static pages, AVIF/WebP images
  dist/
        │
        ▼  tools/generate-redirects.mjs   host config into dist/ and deploy/
        │
        ▼  audit + lighthouse             GATE — SEO, a11y, performance
```

Everything up to `data/` hits the network and is cached on disk
(`audit/.cache/`), so a rebuild is offline and deterministic. `npm run refresh`
re-runs the network stages when the source site changes.

## Why static

Every page on this site is content that is identical for every visitor. Static
output means:

- no server render time, so TTFB is whatever the CDN edge costs
- no runtime dependency that can fail or need patching
- the whole site is a directory that can be served from anywhere

The source site was an Oracle WebLogic application that set a session cookie on
every request, including for anonymous crawlers, which defeats edge caching
entirely. Nothing about the content required that.

## Why almost no JavaScript

The site ships **no third-party script at all** and at most ~2.3 KB of its own
per page. The two interactive pieces are:

| Feature | Implementation | Without JavaScript |
| --- | --- | --- |
| Header menus | `<details>`/`<summary>` + ~600 bytes to close on outside click | Menus still open, close and are keyboard-operable |
| Catalogue filter | ~1 KB over a complete server-rendered list | All 68 products are present; category links still work |
| Site search | ~1.5 KB + a JSON index fetched on first keystroke | Page lists every category and links to both indexes |

Nothing that a crawler or an answer engine needs is behind script. That is the
single largest difference from the source, where the entire product catalogue
was AJAX-only.

## Layers

```
src/
├── config/
│   ├── site-url.mjs      SITE_URL — shared with astro.config.mjs
│   ├── site.ts           Organization facts, all publicly sourced
│   └── routes.mjs        Route policy shared with tools/ia.mjs
├── lib/
│   ├── content.ts        Typed accessors over src/content/*.json
│   ├── images.ts         Source URL -> build-time ImageMetadata
│   ├── lcp.ts            Prepares the LCP image + its preload descriptor
│   ├── seo.ts            Canonicals, titles, JSON-LD builders
│   ├── sections.ts       Section routing, titles, descriptions
│   └── text.ts           Metadata text shaping (trim only, never generate)
├── layouts/Base.astro    The one page shell
├── components/
│   ├── seo/Head.astro    The metadata contract — a page cannot omit it
│   ├── global/           Header, Footer, Breadcrumbs
│   ├── navigation/       Nav data (plain data, rendered as real links)
│   ├── products/         Card, detail, category, filter
│   ├── recipes/          Card, index
│   ├── company/          Section body renderer
│   └── ui/               Logo, PageHero, LcpImage
└── pages/                Routes
```

### Two rules that keep the site correct

1. **Nothing renders without metadata.** `Head.astro` requires `title`,
   `description` and `path`; `Base.astro` requires them too. There is no code
   path that produces a page without a unique title, a description and a
   canonical. `tools/lint.mjs` fails the build if a page component neither
   renders `<Base>` nor delegates to a component that does.

2. **The route policy has one definition.** `src/config/routes.mjs` is plain
   `.mjs` so that both the TypeScript site modules and `tools/ia.mjs` (which
   generates the 1,074 redirects) import the same values. If they drifted, the
   redirect map and the built routes would silently disagree.

## Routing

| Pattern | Source | Count |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | 1 |
| `/products/` | `src/pages/products/index.astro` | 1 |
| `/products/{slug}/` | `src/pages/products/[slug].astro` | 72 |
| `/recipes/` + `/recipes/page/{n}/` | `index.astro` + `page/[page].astro` | 5 |
| `/recipes/{slug}/` | `src/pages/recipes/[slug].astro` | 101 |
| `/shin/` | `src/pages/shin/index.astro` | 1 |
| Bespoke company pages | `about/history`, `about/global`, `about/group`, `contact/location`, `contact/inquiry`, `pr/tv` | 6 |
| Generic section pages | `src/pages/[...section].astro` | 34 |
| `/search/`, `/404.html` | own files | 2 |

`/products/[slug].astro` serves two page types — the four category listings and
the 68 product pages — because they share one URL namespace. A test asserts the
two slug sets never collide.

## Astro configuration decisions

| Setting | Value | Why |
| --- | --- | --- |
| `output` | `static` | Every page is identical for every visitor |
| `trailingSlash` | `always` | One canonical URL form; removes a whole duplicate class |
| `build.format` | `directory` | Clean URLs on any static host without rewrites |
| `build.inlineStylesheets` | `always` | The stylesheet is ~4 KB brotli; a separate render-blocking request costs more than the bytes |
| `image.layout` | `constrained` | Responsive by default without per-image CSS |
| `@astrojs/sitemap` | filtered | Only canonical, indexable URLs |

## Dependencies

Runtime dependencies are three, and each earns its place:

| Package | Why |
| --- | --- |
| `astro` | The framework |
| `@astrojs/sitemap` | Sitemap generation; writing it by hand would duplicate route knowledge |
| `sharp` | Image transcoding at build time (Astro's image service) |

Build-time only: `cheerio` (HTML parsing in the extraction and audit tools),
`typescript` + `@astrojs/check`, `vitest`, `lighthouse` + `chrome-launcher`.

No CSS framework, no component framework, no state library, no animation
library, no icon package. The source site loaded jQuery, jQuery UI, Swiper,
GSAP, Hammer.js, Font Awesome and a self-hosted icon font; none of it was needed
for this content.

## Extending it

**Adding a page type:** add a route under `src/pages/`, render `<Base>` with a
title, description and path, and add its schema to the `graph()` call. The
audits will tell you immediately if the metadata is missing, duplicated or
inconsistent with the visible content.

**Refreshing content from the source:** `npm run refresh`, then `npm run build`.
The crawler and extractors are idempotent; the cache means only changed pages
are re-fetched.

**Adding a locale:** the content models are locale-neutral and every string the
site renders comes from `src/content/`. The work is a locale segment in the
route table plus a per-locale content directory. `hreflang` is deliberately
absent today — see `docs/seo.md`.
