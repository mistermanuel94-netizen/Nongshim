# Source provenance

Every piece of content on this site came from `eng.nongshim.com`, crawled on
**2026-08-30**. This document records what was taken, what was changed, and —
most importantly — what was *not* invented.

## Where each entity came from

| Content | Source URL | Records |
| --- | --- | ---: |
| Products | `/brand/main/viewMore` (all tabs), `/brand/main/container?brandId=` | 68 |
| Pack variants | `/brand/main/detail?prodCode=` | 140 |
| Recipes | `/recipe/recipe_list?page=1..7`, `/recipe/recipe_view?recipeId=` | 101 |
| SHIN character | `/brand/main/index` (the `#shinramyun-popup` modal) | 1 |
| History | `/about/history` | 83 entries |
| Global network | `/about/globalNongshim` | 9 subsidiaries |
| Offices | `/contact/location` | 7 |
| Videos + transcripts | `/pr/tv`, `/pr/ajax.indexList` | 31 |
| Section pages | 42 crawled URLs across About, Sustainability, PR, Investors, Contact | 42 |
| Imagery | `image.nongshim.com` and `/resources/` | 816 files, 116.5 MB |
| Brand marks | `/resources/nongshimCss/images/logo.png`, `/about/ci` artwork | — |

Each record in `data/` carries its own `sourceUrls`, `sourceChecked` date and a
`transformation` string. The raw crawl is cached in `audit/.cache/`, so any
claim here can be checked against the bytes the source actually served.

## Classification of every change

Using the categories from the project brief.

### A — Preserved

Content reproduced with its meaning and wording intact:

- All 68 product names, taglines and descriptions
- All 140 variant names, net weights, release dates and certifications
- All 101 recipe names, summaries, ingredient lists and instruction steps
- SHIN's introduction, five story panels and eight profile fields
- 83 history captions
- 9 subsidiary descriptions, addresses and phone numbers
- 7 office addresses and phone numbers
- 31 video transcripts
- Section page copy across About, Sustainability, PR, Investors and Contact
- The official logo and the CI symbol, used unmodified
- The brand colour system: red `#df0029` and orange `#e4820c`, sampled from the
  official CI artwork; the interface green `#96c11f`/`#539a00` from the source
  stylesheets

### B — Technical improvement (no change of meaning)

| Change | Why |
| --- | --- |
| AJAX fragments turned into pages | The information is identical; only its delivery changed |
| CSS `background-image` turned into `<img>` | Same picture, now with alt text, dimensions and `srcset` |
| Unescaped `<…>` in recipe titles recovered | Browsers parsed these as unknown tags and dropped the text. Recovered from the `alt` attribute, which preserved it, and rendered as real text |
| `http://` asset URLs rewritten to `https://` | Mixed content on an HTTPS page |
| `image.nongshim.com//noo/…` double slashes collapsed | Malformed URL |
| Malformed `url(` values parsed leniently | The source omits the closing parenthesis in inline `background-image` styles |
| 21 outbound links repaired | `http:/host` with a single slash resolves as a same-origin path and 404s. Every recruitment link in the site map was broken. Destinations unchanged |
| Flattened table cells rebuilt as tables | Cells holding only an icon carried no text, so a naive extraction lost column alignment |
| Fonts converted TTF/OTF → WOFF2 | Same typeface, half the bytes |
| Icon fonts replaced with inline SVG | Same glyphs, no font download |
| "Noghshim Flour Mills" → "Nongshim Flour Mills" | An unambiguous typo in the company's own name. The correct spelling appears in the next block of the same page, so the source itself supplies it |

### C — UX improvement

- Product and recipe cards became real links rather than click handlers
- Category tabs became four pages
- The SHIN modal became a page
- The 39-slide carousel became a grid
- Seven eagerly-loaded map iframes became seven `<details>` disclosures
- `/about/group` became a real affiliates index instead of a copy of the
  Holdings page
- Section landing pages list the pages they lead to, with each page's own
  published description

### D — SEO improvement

Unique titles, unique descriptions, canonicals, one descriptive `<h1>` per page,
Open Graph, JSON-LD, `robots.txt`, an XML sitemap, crawlable pagination, and
1,074 redirects from the legacy URL space. None of this changed a fact.

### E — Accessibility improvement

Korean `alt` and `aria-label` text replaced with English; pinch-zoom unblocked;
heading hierarchy corrected; keyboard operability throughout; contrast raised to
AA. See `docs/accessibility.md`.

### F — Performance improvement

See `docs/performance.md`.

### G — Content gaps

**Nothing in this category was filled by invention.** Each item is recorded and,
where a decision was required, the lowest-risk option was taken.

| Gap | Handling |
| --- | --- |
| 35 recipe images return HTTP 200 with a **zero-byte body** | Treated as missing. Recipe heroes fall back to the recipe's own step photography; 10 recipes have no usable image and render a typographic card |
| 2 product card images 404/403 | Fall back to the product's packshot |
| `/pr/pedia` renders a header with no content; `/pr/pedia/detail` returns an empty document | No page built; both 301 to `/press/` |
| `/investors/ir/view` and `/investors/finance/audit_view` return HTTP 404 while being linked | 301 to their list pages |
| Two products share the name *Champong Noodle Soup* | Kept separate; titles disambiguated by published release year. Recommend Nongshim rename one |
| Two recipes share the name *Tray Doongji Cold Noodle* | Kept separate; titles disambiguated with each recipe's own published summary. Recommend Nongshim rename one |
| Untranslated Korean on English pages (`/about/globalNongshim`, `/investors/ir/list`, `/contact/inquiry`, `/pr/tv`) | Omitted rather than shown to English readers. Recommend Nongshim supply translations |
| Some packshots are only 600 px wide | Used at their native size. Upscaling would invent pixels |
| Video publication dates | Not emitted. The source's date field is a CMS record timestamp, not a publication date |
| Product nutrition, ingredients, allergens, prices, availability | Not published by the source, therefore absent here and absent from the structured data |

## Assets

816 files were downloaded from Nongshim's own origins and re-hosted so Astro can
transcode them. They are Nongshim's published imagery, used unmodified apart
from format and resolution.

Two brand assets were derived rather than copied:

- **The favicon set** (`favicon.ico`, `apple-touch-icon.png`, `icon-192.png`,
  `icon-512.png`, `icon-maskable-512.png`) is generated from the official CI
  symbol published on `/about/ci`. The mark is located by its own colour bounds,
  cropped, and the CI plate's measurement grid is flattened to white. The mark
  itself is untouched — **no brand mark was redrawn**.
- **No SVG favicon is shipped.** Tracing a registered mark to vector would mean
  redrawing it, so the official raster is used at every size instead.

## Fonts and licensing

| Font | Decision |
| --- | --- |
| Red Hat Display | SIL OFL 1.1 — redistributable. Self-hosted as a variable WOFF2, Latin subset |
| Noto Sans SC | SIL OFL 1.1, but not needed for an English locale. Dropped |
| icomoon | Icon font. Replaced with inline SVG |
| **SCDream5** | Used by the source for SHIN typography. **Its redistribution licence cannot be verified from public sources, so it is not bundled.** The closest open fallback is used. Flagged for Nongshim to confirm |

## Facts asserted about the organisation

`src/config/site.ts` holds the Organization data used in JSON-LD. Every value is
traceable:

| Field | Source |
| --- | --- |
| `legalName` — Nongshim Co., Ltd. | The source's footer copyright line |
| `foundingDate` — 1965 | `/about/history` (earliest entry) and `/about/overview` |
| `address` — 112 Yeouidaebang-Ro, Dongjak-Gu, Seoul | `/contact/location`, "Korea \| HQ" |
| `telephone` — 080-023-5181 | `/contact/location` |
| `sameAs` — six profiles | Only profiles the source site itself links to: Facebook (×2), Instagram (×2), TikTok, YouTube |

No `sameAs` entry was added from outside the source. No award, certification,
market-share or revenue claim appears anywhere on this site that is not quoted
from a Nongshim page.

## Reproducing the extraction

```bash
npm run crawl     # re-crawl (disk-cached; only changed pages re-fetch)
npm run extract   # rebuild data/ from the cache
npm run assets    # re-download and re-inventory imagery
npm run content   # regenerate routes, redirects and src/content/
```

`audit/site-inventory.json` records every URL crawled with its status, title,
headings, images and links — the evidence base for everything above.
