# Nongshim — English site

A static Astro rebuild of the public English Nongshim site
(`eng.nongshim.com`), reconstructed from public content with the technical
architecture rebuilt underneath it.

```bash
npm ci
npm run build      # 223 pages
npm run preview
```

## What it contains

| | |
| --- | ---: |
| Pages | 223 |
| Products | 68, with 140 pack variants |
| Recipes | 101, with 612 instruction steps |
| Company pages | 42 |
| Redirects from the legacy URL space | 1,074 |
| Images | 801 source files, transcoded per breakpoint |
| Third-party scripts | 0 |
| JavaScript, worst page | 2.3 KB |

| Lighthouse (median of 3) | Mobile | Desktop |
| --- | --- | --- |
| Performance | 96–100 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 96–100 | 96–100 |
| SEO | 100 | 100 |

LCP 1.58–2.41 s on mobile. CLS 0.000 on every page.

## Why it exists

The source site made its most valuable content unreachable. The 68-product
catalogue had no URLs at all — cards were `<a href="javascript:void(0)">` and
detail arrived as AJAX fragments. Every page shared one `<title>`
(`GLOBAL NONGSHIM`). There was no `robots.txt`, no sitemap, no canonical tag and
no structured data. SHIN, the brand character, existed only inside a hidden
JavaScript modal.

This rebuild keeps the content and the brand, and replaces the delivery.

## Commands

```bash
npm run dev              # dev server
npm run build            # validate-content -> astro build -> generate-redirects
npm run preview          # serve dist/

npm run lint             # project rules
npm run typecheck        # astro check
npm test                 # vitest

npm run audit            # validate-content, seo, a11y, perf, browser-test
npm run lighthouse       # real Chrome, median of 3
npm run report           # regenerate derived audit markdown

npm run refresh          # re-crawl the source and rebuild the content models
```

Every gate exits non-zero on failure.

## Layout

```
tools/       build pipeline and audit tooling (never shipped)
data/        raw extraction from the source + generated route tables
src/         the site
audit/       generated audit artefacts
deploy/      generated host configuration
docs/        documentation
```

## Documentation

| Document | Covers |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | How the pipeline and the site are put together, and why |
| [docs/content-model.md](docs/content-model.md) | Entity shapes, relationships, validation |
| [docs/seo.md](docs/seo.md) | Titles, descriptions, canonicals, structured data, internationalisation |
| [docs/aeo-geo.md](docs/aeo-geo.md) | Answer-engine readability and the AI crawler policy |
| [docs/performance.md](docs/performance.md) | Budgets, LCP strategy, images, fonts, measurement |
| [docs/accessibility.md](docs/accessibility.md) | WCAG 2.2 AA state, **and what has not been tested** |
| [docs/design-system.md](docs/design-system.md) | Tokens, type scale, components |
| [docs/redirects.md](docs/redirects.md) | The 1,074-rule migration map, per host |
| [docs/deployment.md](docs/deployment.md) | Host configuration, headers, verification |
| [docs/maintenance.md](docs/maintenance.md) | Refreshing content, extending, troubleshooting |
| [docs/source-provenance.md](docs/source-provenance.md) | What came from where, and what was changed |

Audit artefacts, all machine-generated, are in [`audit/`](audit/). Start with
[`audit/final-qa.md`](audit/final-qa.md).

## Before deploying

1. Set `SITE_URL` to the production origin — it drives every canonical, the
   sitemap and the JSON-LD graph.
2. Apply the host redirect configuration from `deploy/`. **On Cloudflare Pages
   this needs an extra step**; see [docs/redirects.md](docs/redirects.md).
3. Optionally set `PUBLIC_CONTACT_ENDPOINT` for the enquiry form.

Verification commands are in [docs/deployment.md](docs/deployment.md).

## Content and licensing

All content, imagery and brand assets are Nongshim's, taken from the public
site on 2026-08-30. Every record carries its source URL and the transformation
applied; see [docs/source-provenance.md](docs/source-provenance.md).

Red Hat Display is used under the SIL Open Font License 1.1.
