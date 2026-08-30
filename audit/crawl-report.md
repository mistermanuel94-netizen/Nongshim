# Crawl report

Two crawls: the public source site (Phase 1) and the rebuilt site (Phase 17).

---

## Part 1 — the source crawl

`npm run crawl`, 2026-08-30. Starts at `/main/index`, `/brand/main/index` and
`/recipe/recipe_list`, follows every in-scope link recursively, and additionally
enumerates the three AJAX endpoints the source uses to expose products — which a
link-following crawler alone cannot reach.

### Discovery

| Metric | Value |
| --- | ---: |
| URLs fetched | 279 |
| HTTP 200 | 261 |
| HTTP 404 | 11 |
| Fetch errors (timeouts) | 7 |
| External links found | 89 |
| Product families | 68 |
| Pack variants | 140 |
| Recipes | 101 |
| Images referenced | 8,667 |

### Page types found

| Type | URLs |
| --- | ---: |
| Recipe detail | 202 (101 recipes × 2 URL forms) |
| Investors | 22 |
| Company (`/about/`) | 18 |
| Sustainability | 12 |
| Recipe listing | 8 |
| PR | 5 |
| Product listing | 5 |
| Contact | 4 |
| Home | 2 |
| Other | 1 |

### Completeness verification

**Products — 68.** Verified three ways: the source's own hidden field
`<input name="total" value="68">`; enumeration through
`/brand/main/viewMore?start&end&page&tabType` across all five tab values, paging
until a short page; and the union of `data-brand-id` attributes across every
response. All three agree.

**Recipes — 101.** Verified two ways: seven paginated list pages at fifteen per
page (105 slots, 101 unique IDs), and the union of every `recipeId` seen
anywhere in the crawl including cross-links from recipe detail pages. Both
yield the same 101 IDs, so the list pagination exposes the entire library.

**Pagination followed to exhaustion.** The crawler stops only when a page
returns fewer items than the page size or the pagination control offers no
higher number — never at a fixed limit.

### Source defects found by the crawl

| Finding | Detail |
| --- | --- |
| Apex is a JS redirect | `/` returns a 338-byte document whose only content is `location.href = "/main/index"`. Title: `Insert title here` |
| No `robots.txt` | HTTP 404 |
| No XML sitemap | `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml` all 404 |
| `Content-Language: ko-KR` | On every response from the English site |
| Session cookies for anonymous requests | `ccsession`, `ccguid`, `JSESSIONID` set on every request — defeats edge caching |
| Products unreachable by crawling | 68 products behind `javascript:void(0)` and three AJAX endpoints |
| Duplicate recipe URLs | Every recipe at `?recipeId=N` and `?page=P&recipeId=N`, no canonical |
| Internal 404s | 11 — `/investors/ir/view` (×9 with pagination), `/investors/finance/audit_view`, and one same-origin path created by a malformed link |
| Malformed outbound links | 21 distinct `http:/host` links (single slash) that browsers resolve as same-origin paths. Every recruitment link in the site map is broken |
| `/about/group` duplicates `/about/group/holdings` | Byte-identical |
| `/pr/pedia` | 768 bytes: a header and nothing else |
| `/pr/pedia/detail` | Empty document |

---

## Part 2 — the rebuilt-site crawl

`npm run seo-audit`, which crawls `dist/` as a search engine would: starts at
`/`, follows only links present in the HTML, and records what it can reach.

### Reachability

| Metric | Value |
| --- | ---: |
| Pages built | 223 |
| Reachable from `/` by following links | 221 |
| Indexable | 221 |
| In the sitemap | 221 |
| Orphan pages | **0** |
| Broken internal links | **0** |
| Broken in-page anchors | **0** |
| Duplicate content groups | **0** |
| Maximum crawl depth | **3** |
| Pages deeper than 3 | **0** |

The two unreachable pages are `/404.html` and `/search/`, both intentional:
`/search/` is `noindex, follow` and reached from the header search control (an
`aria-label`led link outside `<nav>`), and a 404 page is reached by error, not
by link.

### Crawl traps

None. The rebuilt site emits no crawlable query-parameter URL:

| Source trap | Now |
| --- | --- |
| `?tabType=` category tabs | Four static category pages |
| `?page=` + `?recipeId=` combinations | One canonical URL per recipe |
| `?searchWord=` / `?searchCategory=` | `/search/` is `noindex` and not linked with parameters |
| `?brandId=` / `?prodCode=` fragments | 301 to pages and anchors |

The catalogue filter and the search box write `?q=` and `?category=` with
`history.replaceState`, but those URLs are never linked and never appear in the
sitemap, so a crawler cannot discover them.

### Link graph

`audit/internal-links.md`.

| Metric | Value |
| --- | ---: |
| Internal links (nav + main) | 19,740 |
| Non-descriptive anchors | **0** |
| Product → category coverage | 68/68 |
| Product → related products | 68/68 |
| Recipe → products it uses | 41/101 |

The 60 recipes with no product link are older competition entries naming
discontinued lines. They are reachable through the recipe index, their sibling
recipes, and the sitemap — none is orphaned.

### Rendering

Both raw HTML and browser-rendered output were checked:

- `npm run seo-audit` parses the static HTML only. Every fact it verifies —
  headings, structured data, links, images — is therefore present without
  JavaScript.
- `npm run browser-test` loads all 13 templates in headless Chrome **with
  JavaScript disabled** and confirms the catalogue still shows 68 products, the
  SHIN page still has its heading, profile table and 39 illustrations, and the
  homepage still has 80 navigation links.

There is no content on this site that requires script execution to read.

### Status codes

Verified by `npm run browser-test` against a server configured like production:

| Request | Status |
| --- | --- |
| Any built page | 200 |
| `/this-page-does-not-exist/` | **404**, rendering the custom error page |

No soft-404: the error page is never served with a 200.
