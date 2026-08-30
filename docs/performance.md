# Performance

## Results

Median of three Lighthouse runs per page, `dist/` served over HTTP with brotli
and the production cache headers. Mobile uses Lighthouse's standard 4× CPU
slowdown and Slow 4G throttling.

| Category | Mobile | Desktop |
| --- | --- | --- |
| Performance | 96–100 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 96–100 | 96–100 |
| SEO | 100 | 100 |

| Core Web Vital | Mobile | Threshold |
| --- | --- | --- |
| LCP | 1.58 s – 2.41 s | < 2.5 s |
| CLS | **0.000** on every page | < 0.1 |
| TBT (lab proxy for INP) | 0 – 122 ms | < 200 ms |

Full detail: `audit/lighthouse-report.md` and `audit/performance-report.md`.

## Payload

Initial transfer — the document plus everything that accompanies first paint
(CSS, JS, the font, and images not marked `loading="lazy"`), brotli-compressed:

| Template | Mobile initial |
| --- | ---: |
| Product listing | 80 KB |
| Recipe detail | 77 KB |
| Product category | 76 KB |
| Homepage | 75 KB |
| Recipe listing | 73 KB |
| Product detail | 65 KB |
| Character page | 58 KB |
| Global network | 44 KB |
| History timeline | 43 KB |
| Company page | 41 KB |
| Search | 40 KB |
| 404 | 39 KB |

Maximum JavaScript on any page: **2.3 KB**. Third-party scripts: **0**.
First-paint requests: **4** — the document, the font, the LCP image and its
preload. The stylesheet costs no request because it is inlined.

For comparison, the source site loaded **~2.36 MB of CSS** on every page —
thirteen stylesheets behind a serialised `@import` chain in a 310-byte
`common.css` — plus jQuery, jQuery UI, Swiper, GSAP, Hammer.js, four input
polyfills, Font Awesome from a CDN, a self-hosted icon font, Google Tag Manager
and Naver's `wcslog.js`, all render-blocking in `<head>` with no `defer`.

## How each metric is protected

### LCP

Each template's LCP element is identified explicitly rather than guessed:

| Template | LCP element |
| --- | --- |
| Homepage | Hero packshot |
| Product listing / category | First card image |
| Product detail | Product packshot |
| Recipe listing | First recipe photo |
| Recipe detail | Recipe hero photo |
| Section pages | Jumbotron hero image |
| SHIN | Character illustration |

`src/lib/lcp.ts` prepares it once in page frontmatter. **The same call produces
both the `<img>` attributes and the `<link rel="preload">`**, so the preload and
the rendered element cannot disagree — a mismatched preload is worse than none,
because it downloads a second image. Exactly one image per page carries
`fetchpriority="high"`; a test asserts it.

`decoding="sync"` is deliberately *not* used. It forces the LCP image to decode
on the main thread, which showed up directly as ~300 ms of blocking time on a
throttled mobile CPU during measurement.

### CLS — 0.000 on every page

- Every `<img>` has intrinsic `width` and `height`. `tools/lint.mjs` fails the
  build on an `<Image>` without sizing, and `tools/audit-seo.mjs` fails on a
  rendered `<img>` without dimensions.
- Cards and media use `aspect-ratio`, so the box is reserved before the image
  arrives.
- The font is preloaded and declared with `font-display: swap` against a system
  fallback stack, so the swap does not reflow.
- No content is injected after load. The catalogue filter is `hidden` until its
  script runs and reveals it, which changes nothing above it.

### INP / TBT

There is almost nothing to block on. The interactive pieces use
`<details>`/`<summary>`, so opening a menu is browser-native. The three scripts
total 2.3 KB and attach a handful of listeners.

### TTFB

Static files on a CDN. `deploy/_headers` marks hashed assets
`immutable, max-age=31536000` and HTML `max-age=0, must-revalidate`, so a
redeploy is visible immediately while assets are never re-fetched.

## Images

816 source images, 116.5 MB as published. At build time Astro + sharp transcode
them to WebP at each width a template actually requests.

Representative results:

```
377 KB JPEG  ->  19 KB WebP  (recipe card, 240w)
404 KB JPEG  ->  46 KB WebP  (recipe step, 360w)
161 KB PNG   ->   4 KB WebP  (SHIN hero, 280w)
```

Rules applied throughout:

- `widths` are the sizes a template genuinely uses, clamped so nothing is
  upscaled past the source's intrinsic width
- `sizes` matches the CSS layout, so the browser picks the right candidate
  rather than the largest
- everything below the fold is `loading="lazy" decoding="async"`
- `fetchpriority="high"` only on the single LCP element

**Known limitation.** Lighthouse's `image-size-responsive` audit flags two pages
because some source packshots are only 600 px wide, below what a 2× device
wants for the display size. Upscaling would invent pixels. This is a source
asset limitation and is recorded in `audit/final-qa.md`; the fix is
higher-resolution originals from Nongshim.

## CSS

One stylesheet, ~24 KB raw / ~4 KB brotli, **inlined into every page**. At that
size a separate render-blocking request costs more than the bytes it saves.
Page-specific styles are Astro-scoped and code-split, so a page carries only
what it uses.

The architecture is design tokens (`src/styles/tokens.css`) plus component-
scoped styles. No framework, no utility classes, no duplicated component CSS.
`tools/lint.mjs` fails the build on a hard-coded colour in a component, so every
colour stays auditable for contrast in one file.

## Fonts

One file: Red Hat Display as a **variable** WOFF2 covering weights 400–700 in
the Latin subset — **30 KB**.

The source served three separate uncompressed TTF files for the same family,
plus two OTF weights of Noto Sans SC (not needed for an English locale), plus a
five-format icon font. It also loaded the entire Font Awesome stylesheet from a
third-party CDN for a handful of chevrons; those are now inline SVG.

`font-display: swap` with a system fallback, and the file is preloaded because
it paints every heading.

## Third parties

None, with two scoped exceptions:

- **YouTube** on `/pr/tv/`, as `<iframe loading="lazy">` pointing at
  `youtube-nocookie.com`. Nothing loads until the frame is near the viewport.
- **Google Maps** on `/contact/location/`, behind a `<details>`. The source
  loaded **seven** map iframes on page load; here a map loads only when a
  visitor opens it.

Google Tag Manager and Naver's tracker are not carried over. If analytics is
required, `docs/maintenance.md` covers adding it without regressing the budget.

## Measuring

```bash
npm run perf         # byte budgets from dist/, no browser needed
npm run lighthouse   # real Chrome, median of 3, fails below target
```

`npm run perf` computes the exact image a browser would select from each
`srcset`/`sizes` pair at 390 px/2× and 1440 px/1×, so the numbers reflect what
is actually transferred rather than a naive sum of candidates.

`npm run lighthouse` serves `dist/` with brotli and the production cache
headers. Serving uncompressed would measure the test rig instead of the site —
that mistake initially cost ~7 Lighthouse points.

Set `LH_RUNS=5` for a tighter median on a busy machine. A single throttled
mobile run varies by several points between repeats and is not reportable.

## Budgets

Enforced by `audit/performance-report.md`:

| Metric | Budget | Worst observed |
| --- | --- | --- |
| Initial transfer, mobile | < 250 KB | 80 KB |
| JavaScript per page | < 30 KB | 2.3 KB |
| DOM nodes | < 1500 | 1037 |
| First-paint requests | < 15 | 4 |
| Third-party scripts | 0 | 0 |

## Post-launch

Lab numbers are not field numbers. After launch:

1. Watch Core Web Vitals in Search Console (field data, 28-day rolling).
2. Compare against these lab figures; a large gap usually means CDN
   configuration, not page code — check that brotli and the `immutable` cache
   headers actually reached production.
3. Re-run `npm run lighthouse` before every deploy. It exits non-zero below
   target, so it works as a CI gate.
