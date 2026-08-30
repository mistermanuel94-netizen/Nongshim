# Final QA and acceptance

Run 2026-08-30 against commit-ready `dist/`. Every result below is reproducible
with the command shown.

## Acceptance gates

| Gate | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | **PASS** — 66 files, 0 problems |
| Type check | `npm run typecheck` | **PASS** — 0 errors, 0 warnings, 0 hints across 47 files |
| Content validation | `npm run validate-content` | **PASS** — 0 errors, 34 warnings |
| Build | `npm run build` | **PASS** — 223 pages |
| Tests | `npm test` | **PASS** — 47 tests, 2 files |
| SEO audit | `npm run seo-audit` | **PASS** — 0 errors, 5 warnings |
| Accessibility audit | `npm run a11y-audit` | **PASS** — 0 violations, 223 pages, 18 colour pairings |
| Performance budget | `npm run perf` | **PASS** — worst mobile initial transfer 80 KB against a 250 KB budget |
| Browser regression | `npm run browser-test` | **PASS** — 9 checks |
| Lighthouse | `npm run lighthouse` | **PASS** — median of 3 per page; every category at or above target |
| Redirect generation | `npm run redirects` | **PASS** — 1,074 rules, 7 host formats |

## Migration completeness

| Entity | Source | Rebuilt |
| --- | ---: | ---: |
| Product families | 68 | **68** |
| Pack variants | 140 | **140** |
| Recipes | 101 | **101** |
| Categories | 4 | **4** |
| SHIN profile fields / story panels / illustrations | 8 / 5 / 39 | **8 / 5 / 39** |
| History entries | 83 | **83** |
| Global subsidiaries | 9 | **9** |
| Offices | 7 | **7** |
| Videos with transcripts | 31 | **31** |
| Images acquired | 838 referenced | **801 usable** (37 unavailable at source) |

No publicly available product, recipe or company content was dropped.

## Quality summary

```
pages              223
indexable          221
in sitemap         221
with JSON-LD       222
images             2,677  (all with alt text and intrinsic dimensions)
external scripts   none
orphan pages       0
broken links       0
duplicate groups   0
```

| Lighthouse (median of 3) | Mobile | Desktop |
| --- | --- | --- |
| Performance | 96–100 | 100 |
| Accessibility | 100 | 100 |
| Best practices | 96–100 | 96–100 |
| SEO | 100 | 100 |

| Core Web Vital | Mobile range | Threshold |
| --- | --- | --- |
| LCP | 1.58 – 2.41 s | < 2.5 s |
| CLS | 0.000 | < 0.1 |
| TBT | 0 – 122 ms | < 200 ms |

Worst-case mobile initial transfer: **80 KB**. Maximum JavaScript on any page:
**2.3 KB**.

## Visual and content fidelity

Compared against the source by content rather than by pixel:

| Aspect | Assessment |
| --- | --- |
| Brand identity | Official logo and CI symbol used unmodified; corporate red `#df0029` and orange `#e4820c` sampled from the CI artwork; the interface green retained from the source stylesheets |
| Brand motifs | The rule-and-dot (`.nongshim-box`) reproduced in CSS; the wide "best product" card treatment retained |
| Typography | Red Hat Display, the source's own display face, self-hosted |
| Photography | The source's own product, recipe, facility and character imagery, re-hosted and optimised — no substitutions |
| Copy | Product, recipe, character and company text reproduced verbatim |
| Navigation | The source's information architecture, with products and recipes promoted to real paths |
| Layout | Restructured for responsiveness and semantics rather than pixel-copied — the source's fixed desktop layout does not survive a 320 px viewport |

## Accepted limitations

Each is a source-side constraint, recorded rather than worked around by
inventing data.

| # | Limitation | Effect | Resolution |
| ---: | --- | --- | --- |
| 1 | 37 source assets are unavailable (35 return HTTP 200 with a zero-byte body, 1 × 404, 1 × 403) | 10 recipes render a typographic card instead of a photograph; `Recipe` schema is emitted on 91 of 101 pages because Google requires an image | Nongshim repairs the CDN; `npm run assets` picks them up with no code change |
| 2 | Five pages remain thin | `/investors/audit/`, `/investors/report/`, `/investors/overview/`, `/sustainability/report/`, `/contact/inquiry/` | The source genuinely has little prose. Each states its own contents from its data; padding would be filler |
| 3 | Two products named *Champong Noodle Soup*; two recipes named *Tray Doongji Cold Noodle* | Titles disambiguated with published facts | Nongshim should rename one of each pair |
| 4 | Some packshots are only 600 px wide | Lighthouse `image-size-responsive` deducts 4 points on two pages | Higher-resolution originals from Nongshim |
| 5 | Untranslated Korean on four source pages | Omitted rather than shown to English readers; the Kellogg customer-service notice on `/contact/inquiry` is information English speakers currently lose | Nongshim should supply translations |
| 6 | SCDream5 licence unverifiable | The SHIN typography uses an open fallback | Nongshim confirms redistribution rights |
| 7 | Contact form has no backend | The page shows published contact details and says the form is not connected | Set `PUBLIC_CONTACT_ENDPOINT` |
| 8 | No analytics | No measurement of visitor behaviour | A business decision; see `docs/maintenance.md` |

## Not performed

Stated plainly because these are real gaps in verification, not oversights:

| Item | Note |
| --- | --- |
| Manual screen-reader testing (NVDA / JAWS / VoiceOver) | The markup provides the required structures and the automated audit verifies them, but no listening pass has been done |
| Manual keyboard walkthrough by a person | Automated tabbing verifies order and focus visibility, not whether the experience is sensible |
| Cognitive-accessibility review | Recommended, particularly for the recipe step sequence |
| Cross-browser testing beyond Chromium | Lighthouse and the browser tests run in headless Chrome. The site uses no browser-specific code and no polyfills, but Firefox and Safari have not been exercised |
| Field Core Web Vitals | Lab data only; CrUX data requires production traffic |
| Production deploy verification | The redirect and header configuration is generated and unit-tested but has not been applied to a live host |

## Highest-risk item before launch

**Cloudflare Pages ignores query strings in `_redirects`.** If the site is
deployed there without loading `deploy/redirects.csv` into Bulk Redirects (or
handling it in a Worker), roughly 1,000 legacy URLs — every recipe and every
product fragment — will return 404 instead of redirecting. The generated
`deploy/cloudflare-pages_redirects` states this at the point where the missing
rules would be. Netlify, Vercel, Apache and Nginx handle all 1,074 rules as
generated.

The second-highest is `SITE_URL`: building with the wrong value produces wrong
canonicals on all 223 pages. `docs/deployment.md` has the verification command.

## Verdict

Every gate in the acceptance list passes. The complete public catalogue,
recipe library and company content are migrated with provenance. The limitations
above are properties of the source, are documented, and none was resolved by
inventing data.

**The build is ready to deploy** once `SITE_URL` is set and the host's redirect
configuration is applied.
