# Maintenance

## Day-to-day commands

```bash
npm run dev              # dev server
npm run build            # validate-content -> astro build -> generate-redirects
npm run preview          # serve dist/

npm run lint             # project rules (see docs/design-system.md)
npm run typecheck        # astro check
npm test                 # vitest: content model + built output

npm run audit            # validate-content, seo, a11y, perf, browser-test
npm run lighthouse       # real Chrome, median of 3, fails below target
npm run report           # regenerate the derived audit markdown

npm run refresh          # crawl -> extract -> assets -> content
```

Every gate exits non-zero on failure, so they compose directly into CI.

## Refreshing content from the source

```bash
npm run refresh
npm run build
npm test
```

`npm run refresh` runs the four network stages. Responses are cached on disk in
`audit/.cache/`, so an unchanged page is not re-fetched. New products, variants
and recipes flow through routes, redirects, relationships, the sitemap and the
search index without any code change.

**What to check after a refresh.** The product and recipe counts are asserted in
`tests/content.test.ts`:

```ts
const EXPECTED_PRODUCTS = 68;
const EXPECTED_RECIPES = 101;
```

If the source catalogue genuinely changes, the test fails — deliberately. Update
the constants **only after confirming the change is real** by reading
`audit/site-inventory.json`. A silently shrinking catalogue is exactly the
failure this guards against.

## Adding content by hand

The content models are plain JSON with a documented shape
(`docs/content-model.md`). To add a product without re-crawling, append a record
to `src/content/products.json` with the same fields, put its images in
`src/assets/source/`, and run `npm run validate-content`. The validator will
tell you precisely what is missing.

## Adding a page

1. Create the route under `src/pages/`.
2. Render `<Base>` with `title`, `description` and `path`.
3. Build its schema with `graph([...])` from `src/lib/seo.ts`.
4. Add it to `NAV` in `src/components/navigation/navigation.ts` if it belongs in
   the navigation, or link it from a relevant page — the audit fails on orphans.
5. `npm run build && npm run audit`.

The audits will immediately tell you if the title or description duplicates
another page, if the heading order skips a level, if an image lacks dimensions,
or if the structured data claims something the page does not show.

## Adding analytics

The source ran Google Tag Manager and Naver's `wcslog.js`. Neither is carried
over. If analytics is required:

- Prefer a server-side or edge solution (Cloudflare Web Analytics, Plausible,
  Netlify Analytics) — these cost nothing on the client and need no consent
  banner in most jurisdictions.
- If a client script is unavoidable, load it with `defer`, add its origin to the
  CSP in `tools/generate-redirects.mjs`, and re-run `npm run lighthouse` before
  and after. The current worst-case mobile Performance is 96; a tag manager
  typically costs 5–15 points.
- Update `tests/build.test.ts`, which currently asserts that no page loads a
  third-party script. Changing that assertion should be a deliberate, reviewed
  decision.

## Changing the AI crawler policy

One list, in `src/pages/robots.txt.ts`. The rationale for the current
permissive stance is in `docs/aeo-geo.md`; it is a publishing decision that
belongs to Nongshim, and it is trivially reversible.

Note that `Google-Extended` controls Gemini training and grounding but does
**not** affect Google Search indexing or AI Overviews — those follow the ordinary
`Googlebot` rules.

## Dependency hygiene

```bash
npm audit
npm outdated
```

Runtime dependencies are three: `astro`, `@astrojs/sitemap`, `sharp`. Everything
else is build-time only and never reaches a visitor.

Before adding a dependency, check whether the platform already does it. Most of
what a package would provide here — disclosure widgets, tabs, lazy loading,
responsive images, form validation — is native. The source site shipped jQuery,
jQuery UI, Swiper, GSAP, Hammer.js, Font Awesome and an icon font for behaviour
that this rebuild gets from HTML and CSS.

## Things that will need attention

| Item | When | What to do |
| --- | --- | --- |
| Source assets that return zero bytes | Whenever Nongshim fixes them | Re-run `npm run assets`; the 10 image-less recipes will pick their photographs up automatically |
| Duplicate product and recipe names | If Nongshim renames one of each pair | Remove the disambiguation and let the slug simplify; add a redirect from the old slug |
| Untranslated Korean on English pages | If Nongshim supplies translations | Remove the Korean filter in `tools/extract.mjs` and re-extract |
| Low-resolution packshots | If higher-resolution originals become available | Replace in `src/assets/source/`; Lighthouse's `image-size-responsive` audit will clear |
| SCDream5 licence | If Nongshim confirms redistribution rights | Add the WOFF2 and point the SHIN typography at it |
| Contact form endpoint | Before launch | Set `PUBLIC_CONTACT_ENDPOINT` |
| HSTS preload | After confirming every subdomain serves HTTPS | Raise `max-age` in `tools/generate-redirects.mjs` |

## When something breaks

| Symptom | Look at |
| --- | --- |
| Build fails at content validation | `npm run validate-content` names the record and the field |
| A page has no title or description | It cannot — `Head.astro` requires both. Check the page renders `<Base>` |
| Duplicate title or description | `npm run seo-audit` names both pages |
| Broken internal link | `audit/broken-links.csv` |
| Lighthouse regression | Compare `audit/lighthouse.json` against the previous run; check brotli and cache headers first |
| Layout shift appears | An image lost its dimensions — `npm run lint` catches it at source, `npm run seo-audit` in the output |
| A redirect stopped working | `audit/redirect-map.csv` has the rule; check the host actually applied the query-string half |

## Keeping the audits honest

The audits are only useful while they are strict. If a check starts producing
noise, fix the cause rather than loosening the rule — and if a rule genuinely
needs relaxing, record why in this file. The current accepted exceptions:

- Five thin-content warnings on document-index and form pages, where the source
  genuinely has little text and padding it would be filler.
- `image-size-responsive` on two pages, where the source packshots are lower
  resolution than a 2× display wants.

Both are recorded in `audit/final-qa.md`.
