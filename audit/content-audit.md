# Content audit

Source crawled 2026-08-30. Every count here is produced by
`npm run validate-content` and `npm run report`, not typed by hand.

## Migration completeness

| Entity | Source | Rebuilt | Coverage |
| --- | ---: | ---: | --- |
| Product families | 68 | 68 | 100% |
| Pack variants | 140 | 140 | 100% |
| Recipes | 101 | 101 | 100% |
| Product categories | 4 | 4 | 100% |
| SHIN profile fields | 8 | 8 | 100% |
| SHIN story panels | 5 | 5 | 100% |
| SHIN illustrations | 39 | 39 | 100% |
| History entries | 83 | 83 | 100% |
| Global subsidiaries | 9 | 9 | 100% |
| Offices | 7 | 7 | 100% |
| Videos with transcripts | 31 | 31 | 100% |
| Section pages | 42 | 40 + 2 consolidated | see below |

The product count is verified against the source's own hidden field
(`<input name="total" value="68">`) and against enumeration through
`/brand/main/viewMore` across all five tab values. The recipe count is verified
against seven paginated list pages at fifteen per page, cross-checked against
every `recipeId` discovered anywhere in the crawl.

## Field coverage

### Products (68)

| Field | Present | Note |
| --- | ---: | --- |
| Name | 68 | |
| Tagline | 68 | The source's "kinds" line |
| Description | 68 | The product's own paragraphs, verbatim |
| Category | 68 | |
| Card image | 68 | 2 fall back to the packshot; see below |
| Hero image | 68 | |
| Net weight | 51 | 17 products publish none |
| Release date | 64 | 4 publish none |
| Certification | 4 | Only Shin Ramyun's variants carry HALAL |
| Variants | 68 | 140 total, 1–8 per product |

Absent because the source publishes none: price, availability, SKU, GTIN,
ingredients, nutrition, allergens, ratings, reviews.

### Recipes (101)

| Field | Present |
| --- | ---: |
| Name | 101 |
| Summary ("Neat explanation") | 101 |
| Ingredient list | 101 |
| Instruction steps | 101 (612 steps total) |
| Steps with a photograph | 407 of 612 |
| Hero image | 91 |
| Competition annotation | 18 |
| Named Nongshim product | 41 |

Absent because the source publishes none: yield, prep time, cook time,
nutrition, author, publication date, ratings.

## Source assets the CDN could not serve

37 of 838 referenced assets (4.4%):

| Failure | Count | Effect |
| --- | ---: | --- |
| HTTP 200 with a **zero-byte body** | 35 | Genuinely broken images on `image.nongshim.com` |
| HTTP 404 | 1 | `angry-chapaguri` card image |
| HTTP 403 | 1 | `shin-ramyun-light` card image — the source URL is truncated to `brand/info/` with no filename |

By usage:

| Usage | Affected |
| --- | ---: |
| Recipe hero | 11 |
| Recipe step | 13 |
| Recipe gallery | 11 |
| Page hero | 14 |
| Product card | 2 |

**Handling.** None of these is replaced with a substitute image. The build
resolves in a defined fallback order and renders a real empty state when nothing
is available:

- Both affected products fall back to their own packshot, so no product card is
  imageless.
- Recipes fall back to their own step photography.
- **10 recipes have no usable image at all** and render a typographic card
  carrying the brand rule-and-dot motif:
  `hooroorook-captivated-noodle`, `taiwanese-fried-noodle-eggnet`,
  `rice-noodle-guobatang`, `chalbibimmyun-salad-yam-un-sen`, `cha-cheegg`,
  `jinjja-jinjja-komkomkom-mie-goreng`, `champaghetti`,
  `salad-ni-oise-vegetable-soup-noodle`, `japanesse-hot-pot-kalguksoo`,
  `savory-rice-cake-noodle-pasta`.

Full list: `audit/unavailable-assets.json`. These are source-side defects; if
Nongshim repairs them, `npm run assets` picks the images up with no code change.

## Content gaps in the source

### Pages that render nothing

| Source URL | Observed | Handling |
| --- | --- | --- |
| `/pr/pedia` | 768 bytes of content: a header and nothing else | No page built; 301 to `/press/` |
| `/pr/pedia/detail` | Empty document | No page built; 301 to `/press/` |
| `/investors/ir/view` | **HTTP 404** while linked from the list page | 301 to `/investors/ir/` |
| `/investors/finance/audit_view` | **HTTP 404** while linked | 301 to `/investors/audit/` |
| `/about/group` | Byte-identical copy of `/about/group/holdings` | Replaced with a real affiliates index |

### Duplicate entity names

Two pairs of genuinely distinct entities share a display name. They are **not
merged** — the source publishes them as different things — and are disambiguated
using published data.

| Pair | Distinguishing published facts | Resolution |
| --- | --- | --- |
| *Champong Noodle Soup* ×2 | Released 1992.07.31 (124g, "Cuttlefish makes champong delicious!") vs 2015.11.16 (130g, "Unforgettable taste!") | Slugs `champong-noodle-soup-1992` / `-2015`; titles carry the year |
| *Tray Doongji Cold Noodle* ×2 | Recipe 6 uses vegetables and cold-noodle sauce; recipe 119 uses beef leg and chicken broth | Slugs carry the source recipe ID; titles carry each recipe's own summary opening |
| *Onion Rings* ×2 variants on one product page | Different `prodCode` (10099, 10050) | Anchors disambiguated by product code |

**Recommendation:** Nongshim should rename one of each pair. Two products under
one name is a merchandising ambiguity, not just an SEO one.

### Untranslated Korean on the English site

| Page | Content |
| --- | --- |
| `/about/globalNongshim` | A definition list of subsidiary names entirely in Korean (생산법인 / 판매법인) |
| `/investors/ir/list` | Table caption 실적발표자료 테이블 |
| `/contact/inquiry` | A Kellogg customer-service notice, Korean only |
| `/pr/tv` | Section heading 농심TV |
| SHIN gallery | 39 `alt` attributes, plus header `title` and `aria-label` strings |

**Handling.** Korean strings are omitted from the English site rather than shown
to English readers, and the audit fails the build if any reaches a page. The
SHIN alt text was rewritten in English. **Recommendation:** Nongshim should
supply English equivalents; the Kellogg notice in particular is information an
English-speaking customer needs.

### Editorial corrections

One, and only where the source itself supplies the correct form:

| Source | Corrected to | Justification |
| --- | --- | --- |
| "Noghshim Flour Mills" (`/about/group/rfm` heading) | "Nongshim Flour Mills" | An unambiguous typo in the company's own name. The correct spelling appears in the very next block of the same page |

Applied through an explicit `TYPO_FIXES` table in `tools/build-content.mjs`, so
the change is visible in one place rather than buried in a template.

### Text recovered from broken markup

Recipe titles carry competition metadata in unescaped angle brackets:

```
Beef Bone Chajang Soup <The 7Th Noodle Dish Open Exhibition Prizewinning Work_The 3Rd Prize>
```

Browsers parse `<The 7Th …>` as an unknown tag and **drop it from the rendered
page**, so 18 recipes displayed a truncated title on the source site. The `alt`
attribute preserved the full string, and it is recovered from there and rendered
as real text below the heading.

### Thin pages

Five pages remain below the audit's content threshold. All are document indexes
or a form, where the source genuinely has little prose:

| Page | Words | Note |
| --- | ---: | --- |
| `/investors/audit/` | 33 | The substance is a 4-row table of audit reports |
| `/investors/report/` | 44 | A list of annual report years |
| `/sustainability/report/` | 55 | A list of report years |
| `/investors/overview/` | 55 | A hub page; now lists its section's children |
| `/contact/inquiry/` | 45 | A form plus published contact details |

Each states its own contents in prose ("This page lists 4 audit reports covering
2025 to 2026") derived from its table, and section landings list their children
with each child's own description. **They were not padded with filler.**

## Provenance

Every record carries `sourceUrls`, `sourceChecked` and a `transformation`
string. The transformation classes used:

| Class | Meaning | Applied to |
| --- | --- | --- |
| `structure-only` | Markup normalised, copy untouched | Products, recipes, pages, network, offices |
| Annotation recovery | Text browsers dropped, restored | 18 recipe titles |
| Korean omission | Untranslated strings removed | History, network, videos, section pages |
| Wordmark substitution | "SHIN" images replaced with the word they depict | Character content |
| Asset normalisation | `http:` → `https:`, double slashes collapsed | All imagery |

Full classification: `docs/source-provenance.md`.

## Validation

```
npm run validate-content
  68 products, 101 recipes, 42 section pages, 223 routes, 1074 redirects
  0 errors, 34 warnings
```

All 34 warnings are the source-side asset failures documented above. Zero errors
means no duplicate slug, no broken relationship, no missing alt text, no
redirect chain and no image record pointing at a file that is not on disk.
