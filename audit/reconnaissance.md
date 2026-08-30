# PHASE 0 — Project Reconnaissance

**Date:** 2026-08-30
**Source of truth:** `https://eng.nongshim.com/` (public HTML/CSS/JS/assets only)
**Target repository:** `E:\VS CODE\Nongshim\Nongshim` (branch `main`)

---

## 1. Repository state

| Item | Finding |
| --- | --- |
| Working tree | **Empty** — git-initialised, zero commits, no files |
| Framework | None present. Greenfield build. |
| Build tooling | None present. |
| Deployment config | None present. |
| Existing assets | None present. |

**Consequence:** there is no legacy code to migrate or preserve. The entire project is a
clean-room reconstruction driven by the public source site. No architectural debt is inherited.

**Local toolchain verified:**

| Tool | Version |
| --- | --- |
| Node.js | 24.16.0 |
| npm | 11.13.0 |
| Python | 3.14.6 |
| curl | 8.19.0 |
| Platform | Windows 10 Pro (win32), PowerShell + Git Bash |

Node 24 comfortably satisfies Astro 5's `>=18.20.8` engine requirement.

---

## 2. Source site — server & delivery

```
GET https://eng.nongshim.com/            -> 200, Content-Length: 338
```

The document root is **not** the homepage. It is a 338-byte HTML 4.01 stub whose only content is:

```html
<script type="text/javascript">location.href = "/main/index";</script>
```

**Finding R-01 (critical, SEO).** The site's entry point is a client-side JavaScript
redirect, not an HTTP 301/302. Link equity to the apex path is not passed, and any crawler
that does not execute JavaScript sees a blank page with `<title>Insert title here</title>`.

Response headers observed:

| Header | Value | Note |
| --- | --- | --- |
| `Server` | `Apache` (fronting Oracle WebLogic — 404 body is the WebLogic default) | |
| `Content-Language` | `ko-KR` | **Wrong** for an English-language site (Finding R-02) |
| `Content-Type` | `text/html; charset=UTF-8` | OK |
| `Set-Cookie` | `ccsession`, `ccguid`, `JSESSIONID` | Session cookies set on every request, including for anonymous crawlers — defeats CDN/edge caching |
| Compression | none negotiated in observed responses | |
| Cache headers | none; pages carry `<meta http-equiv="Cache-Control" content="No-Cache">` | Finding R-03 |

**Finding R-04.** `/robots.txt` returns **404**. There is no crawl directive file at all.
**Finding R-05.** `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap-index.xml` all return **404**.
There is no XML sitemap. Every URL must be discovered by link-following, and the site's most
valuable content (products) is not linked at all — see §4.

---

## 3. Public route map (discovered)

The public English site is a single Java/WebLogic application serving six top-level sections.
Navigation is server-rendered in the HTML (good — crawlable), and is identical on every page.

| Section | Root | Child routes discovered |
| --- | --- | --- |
| Home | `/main/index` | — |
| About | `/about/overview` | `/about/profile/mission`, `/about/profile/way`, `/about/history`, `/about/ci`, `/about/globalNongshim`, `/about/group` + 10 affiliate pages |
| Brand (products) | `/brand/main/index` | `?tabType=instant\|snacks\|beverages\|simple` |
| Recipes | `/recipe/recipe_list` | `?page=1..7`, `/recipe/recipe_view?recipeId=N` |
| Sustainability | `/sustainability/overview` | `governance/{governance,compliance}`, `people/{safety,shared,social,youlchon}`, `planet/{response,sustainable}`, `prosperity/{consumer,rnd}`, `/sustainability/report` |
| PR | `/pr/overview` | `/pr/tv`, `/pr/pedia`, `/pr/pedia/detail`, `/pr/baduk` |
| Investors | `/investors/overview` | `/investors/report`, `/investors/ir/list` (+`/view`), `/investors/finance/audit_list` (+`/view`) |
| Contact | `/contact/overview` | `/contact/location`, `/contact/inquiry`, `/contact/inquiry_check` |

Affiliate pages under `/about/group/`: `holdings`, `hotelNongshim`, `megaMart`, `nds`,
`nongshimCommunication`, `nongshimDevelopment`, `nongshimEngineering`, `rfm`,
`taekyungNongsan`, `youlchonChemical`, `youlchonFoundation`.

---

## 4. Critical discovery — products have no URLs

This is the single most consequential finding of reconnaissance.

`/brand/main/index` renders a product grid, but **every product card is inert**:

```html
<div class="col-lg-3 col-md-6 col-6" data-role="detail" data-brand-id="ansung">
  <div class="md-product product-ansung" data-index="ansung" data-prod-code="ansung">
    <a href="javascript:void(0)">          <!-- no href -->
      <div class="img" style="background-image:url(https://image.nongshim.com/...png)">
```

Product detail is injected by jQuery from two AJAX fragment endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /brand/main/viewMore?start&end&page&tabType&searchCategory&searchWord` | Paginated product grid HTML, 24 per page |
| `GET /brand/main/container?brandId={id}&isMobile=N` | Product-family detail fragment (gallery + spec table + description) |
| `GET /brand/main/detail?prodCode={numericCode}` | Per-variant detail fragment (name, weight, release date, certification, description) |

**Finding R-06 (critical).** Nongshim's entire English product catalogue — **68 product
families** and their packaging variants — is invisible to search engines and AI retrieval
systems. There is no crawlable URL for Shin Ramyun, Chapaghetti, Neoguri or any other
product. A query like *"What is Shin Ramyun?"* cannot be answered from this site's HTML.

The hidden field `<input name="total" value="68">` confirms the catalogue size.
Enumeration via `viewMore` across all tabs yields **68 unique `brandId` values**, verified
against that total.

**Finding R-07.** Category tabs are exposed as `?tabType=…#tab-move` links but the tab
content is replaced client-side; the four category views are not distinct indexable
documents.

**Finding R-08.** Product search (`searchWord` / `searchCategory`) posts to the same
AJAX endpoint. There are no indexable search-result URLs — neither a crawl trap (good)
nor a usable no-JS experience (bad).

---

## 5. Recipes — crawlable, but weakly

`/recipe/recipe_list` is server-rendered with real `<a href>` links and numbered
pagination across **7 pages × 15 items**. Detail pages live at
`/recipe/recipe_view?recipeId={N}` and contain genuinely structured content:

- Title (`h2.header-heading`)
- Hero image (background-image on a Swiper slide)
- "Neat explanation" — a one-line summary
- "Ingredient" — a free-text ingredient list
- Numbered cooking steps, each with its own step image

**Finding R-09.** This is complete, real `Recipe` structured-data-eligible content, and the
source emits **zero JSON-LD**. Large untapped rich-result opportunity.

**Finding R-10.** Recipe titles carry raw competition metadata inside angle brackets, e.g.
`Beef Bone Chajang Soup <The 7Th Noodle Dish Open Exhibition Prizewinning Work_The 3Rd Prize>`.
Because these are unescaped `<…>` sequences inside HTML text nodes, browsers parse them as
unknown tags and **silently drop them from the rendered page**. The `alt` attributes retain
them. This is a source-side HTML escaping bug — classified as **B. Technical improvement**
to fix (escape correctly), not an editorial rewrite.

**Finding R-11.** Recipe list `<a href>` values are relative (`recipe_view?...`) and include a
redundant `langCd=E` parameter, creating duplicate URL forms for identical content.

---

## 6. SHIN character experience

The SHIN brand character content exists **only inside a JavaScript-toggled modal** on
`/brand/main/index` (`#shinramyun-popup`). It contains substantial public content:

- Character story ("This is how my journey began") — 5 narrative panels
- Profile table — Name, Dream, Hobby, Likes, Personality, Features, Strength, Weakness
- A 39-image pose gallery

**Finding R-12 (critical, AEO/GEO).** *"Who is SHIN?"* is unanswerable from this site.
The content is present in the HTML but hidden behind `display:none` in a modal with no
URL of its own (only a `#shinramyun-popup` hash), no heading hierarchy reachable by
crawlers as page content, and key text baked into images (`shin-txt-icon.png` renders the
word "SHIN" as a picture inside sentences).

**Finding R-13 (accessibility).** Every SHIN image carries **Korean** alt text on the
English site (`alt="축구하는 캐릭터"`, `alt="SHIN 캐릭터 포즈1"` ×39), and the modal's
close button is `aria-label="팝업 닫기"`. English-site screen-reader users receive Korean.
The same pattern appears in the global header: `title="전체메뉴 보기"`,
`<strong class="visually-hidden">언어변경</strong>`, `title="구분선택 입력상자"`.

---

## 7. Metadata baseline (source)

| Signal | Source site status |
| --- | --- |
| `<title>` | **`GLOBAL NONGSHIM` on essentially every page.** Verified across `/about/overview`, `/about/history`, `/about/profile/mission`, `/about/globalNongshim`, `/sustainability/overview`, `/brand/main/index`, `/recipe/recipe_view`. Total title duplication. |
| `<meta name="description">` | Absent on most pages. Present on `/about/history` and `/recipe/recipe_list` only. |
| `<link rel="canonical">` | **Absent site-wide.** |
| `<h1>` | The site logo is the `<h1>` on every page. Page subject headings are `<h2>`. Every page therefore has the same, non-descriptive H1. |
| Open Graph / Twitter cards | **Absent site-wide.** |
| JSON-LD structured data | **Absent site-wide.** |
| `hreflang` | Absent. Language switching is a plain link list to `www.nongshim.com` (Kr) and `cn.nongshim.com` (Cn). |
| `<html lang>` | `en` — correct, but contradicted by the `Content-Language: ko-KR` response header. |
| Doctype | HTML5 on app pages; HTML 4.01 Transitional on the root stub. |

---

## 8. Front-end payload audit (source)

**CSS.** `common.css` is a 310-byte file consisting solely of eleven `@import url(...)`
statements — a fully serialised, render-blocking waterfall. Combined with `style.css` and a
full unminified Bootstrap 4.4.1:

| File | Bytes (uncompressed) |
| --- | --- |
| `bootstrap.css` | 320,691 |
| `style.css` | 112,034 |
| `promotion.css` | 477,566 |
| `management_01.css` | 418,295 |
| `management.css` | 244,643 |
| `base.css` | 235,975 |
| `util.css` | 128,522 |
| `introduc.css` | 128,182 |
| `layout.css` | 127,293 |
| `customer.css` | 104,909 |
| `mypage.css` | 28,338 |
| `invest.css` | 24,980 |
| `popup.css` | 4,482 |
| `swiper.min.css` | (plugin) |
| **Total** | **≈ 2.36 MB of CSS shipped to every page** |

**Finding R-14 (critical, performance).** ~2.36 MB of largely unused CSS is loaded on every
page, via an `@import` chain that cannot be parallelised.

**JavaScript.** jQuery + jQuery UI + Swiper + GSAP + Hammer.js + four bespoke input
polyfills + `ui.js`/`pattern.js`/`header.js`/`footer.js`/`intergation.js`, all loaded as
**render-blocking `<script>` in `<head>` with no `defer`/`async`**.

Third parties: Google Tag Manager (`GTM-M35L4G7`), Naver `wcslog.js`, Font Awesome 5.13.0
from cdnjs (an entire icon CSS bundle), plus a self-hosted `icomoon` icon font.

**Finding R-15.** Icons are delivered twice over — a full Font Awesome stylesheet from a
third-party CDN *and* a self-hosted icomoon font — for a handful of chevrons and arrows.

**Fonts.**

| Family | Format served | Licence status |
| --- | --- | --- |
| Red Hat Display (400/500/700) | `.ttf` (truetype) | SIL OFL 1.1 — redistributable; WOFF2 available |
| Noto Sans SC (400/700) | `.otf` (OpenType) | SIL OFL 1.1 — redistributable; not needed for an English locale |
| icomoon | eot/woff2/ttf/woff/svg | Icon font — replaceable with inline SVG |
| SCDream5 | `.otf` served as `format("truetype")` | Third-party commercial Korean face, **licence not publicly established** |

**Finding R-16 (performance).** Text fonts are served as uncompressed TTF/OTF rather than
WOFF2 — roughly 2× the necessary bytes — with no `font-display` on the text faces.

**Finding R-17 (legal).** `SCDream5.otf` is used for SHIN character typography. Its
redistribution licence cannot be verified from public sources. **Decision: do not bundle
it.** Use the closest metric-compatible open fallback. Flagged for client confirmation.

---

## 9. Imagery

Content imagery is hosted on a separate origin, `https://image.nongshim.com/`:

- `image.nongshim.com/brand/info/*.png|jpg` — product listing cards
- `image.nongshim.com/non/pro/*_en.png` — product variant packshots (English packaging)
- `image.nongshim.com/noo/foreign/recipe/*.jpg` — recipe hero and step photography
- `image.nongshim.com/popup/img/*.png` — featured/best-product banners

UI/brand assets are local under `/resources/nongshimCss/images/` and `/resources/images/`.

**Finding R-18.** Most content images are applied as CSS `background-image`, not `<img>`.
They therefore have **no `alt` text, no intrinsic dimensions, no `srcset`, no lazy-loading
and no participation in image search**. This affects the product grid, product detail
galleries, recipe heroes and every recipe step photo.

**Finding R-19.** Several inline background URLs are **malformed — the closing parenthesis
is missing**, e.g.

```html
<div class="swiper-slide" style="background-image:url(https://image.nongshim.com/non/pro/Shin_Ramyun_en.png" data-prod-code="10065">
```

The unterminated `url(` swallows the rest of the attribute. Browsers recover, but the value
is invalid CSS. Extraction tooling must tolerate this.

**Finding R-20.** Recipe list image URLs contain a double slash
(`image.nongshim.com//noo/foreign/recipe/…`), and recipe detail pages reference the same
host over **plain `http://`** — mixed content on an HTTPS page.

**Finding R-21.** Favicon provision is a single legacy `/resources/images/nongshim.ico`.
No SVG favicon, no Apple touch icon, no web app manifest, no theme colour.

---

## 10. Design system signals (preliminary)

Colour frequency across all 13 stylesheets (Bootstrap defaults excluded from interpretation):

| Colour | Occurrences | Role |
| --- | --- | --- |
| `#96c11f` | 246 | **Nongshim signature green — primary brand colour** |
| `#539a00` | 169 | Deep green — hover/active, secondary brand |
| `#d83832` | 70 | Red accent |
| `#ca0202` | 53 | Shin red (product/brand context) |
| `#ec870c` | — | Orange accent |
| `#0a3398` | 29 | Deep blue (investors section) |
| `#ffffff` / `#000000` | 667 / 349 | Ground / ink |
| `#666666`, `#333333`, `#999999`, `#888888`, `#222222` | — | Neutral text ramp |
| `#f6f6f6`, `#f4f4f4`, `#f1f1f1`, `#f0f0f0` | — | Surface tints |
| `#e4e4e4`, `#e8e8e8`, `#d2d2d2` | — | Borders |

Type scale in use: 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 30, 36, 76, 96 px.
Breakpoints observed: 540, 720, 960 (`959.98`), 991/992, 1200 (`1199.98`), 1600 px —
Bootstrap 4 defaults plus bespoke `960`/`991` variants used inconsistently.

**Finding R-22.** `<meta name="viewport" content="…user-scalable=no,maximum-scale=1,…">`
blocks pinch-zoom. This is a **WCAG 2.2 SC 1.4.4 (Resize Text) failure** and will be removed.

---

## 11. Outbound / cross-property links

The footer "Family Link" panel and site map link to ~30 external Nongshim-group properties.
These are legitimate public entity relationships worth preserving (they are useful `sameAs`
and contextual-link signals).

Verified public social profiles referenced by the source:

| Profile | URL | Context |
| --- | --- | --- |
| Facebook (corporate) | `https://www.facebook.com/nongshim` | global footer |
| Facebook (worldwide) | `https://www.facebook.com/nongshimworldwide/` | brand page |
| Instagram (corporate) | `https://www.instagram.com/nongshim/` | global footer |
| Instagram (global) | `https://www.instagram.com/nongshimglobal` | brand page |
| TikTok (global) | `https://www.tiktok.com/@nongshimglobal` | brand page |
| YouTube | `http://www.youtube.com/user/nongshimPR` | global footer |

**Finding R-23 (broken links in source).** Twenty-one outbound links are malformed with a
**single slash after the scheme** — `http:/recruit.nongshim.com/…`,
`https:/www.ndscareers.com/…`, `http:/www.youlchon.com/…`. Browsers resolve these as
*same-origin relative paths*, so they 404 on `eng.nongshim.com`. Every recruitment link in
the site map is broken. Confirmed by crawl: `/www.ndscareers.com/nds_recruit/main.jsp` was
reached as an internal path.

---

## 12. Summary of reconnaissance findings

| ID | Severity | Finding |
| --- | --- | --- |
| R-01 | Critical | Apex URL is a JS redirect, not an HTTP redirect |
| R-02 | High | `Content-Language: ko-KR` on the English site |
| R-03 | Medium | `No-Cache` meta on all pages; session cookies defeat edge caching |
| R-04 | High | No `robots.txt` (404) |
| R-05 | Critical | No XML sitemap (404) |
| R-06 | **Critical** | 68-product catalogue has **no crawlable URLs** — AJAX-only |
| R-07 | High | Category tabs are not distinct documents |
| R-08 | Medium | Product search has no no-JS fallback |
| R-09 | High | Recipe content is rich but emits no `Recipe` JSON-LD |
| R-10 | Medium | Unescaped `<…>` in recipe titles silently drops text |
| R-11 | Medium | Duplicate recipe URL forms via `langCd=E` |
| R-12 | **Critical** | SHIN character content has no URL; unanswerable by AI |
| R-13 | High | Korean `alt`/`aria-label` text throughout the English site |
| R-14 | **Critical** | ~2.36 MB CSS on every page via serialised `@import` chain |
| R-15 | Medium | Two icon systems shipped (Font Awesome CDN + icomoon) |
| R-16 | High | Fonts served as TTF/OTF, not WOFF2; no `font-display` |
| R-17 | Legal | `SCDream5.otf` licence unverifiable — will not be bundled |
| R-18 | **Critical** | Content imagery is CSS backgrounds — no alt, no srcset, no lazy-load |
| R-19 | Medium | Malformed `url(` values (missing `)`) in inline styles |
| R-20 | Medium | Double slashes and `http://` mixed content on image URLs |
| R-21 | Medium | Favicon system is a lone legacy `.ico` |
| R-22 | High | `user-scalable=no` — WCAG 1.4.4 failure |
| R-23 | High | 21 outbound links malformed (`http:/host`), resolve as 404s |

---

## 13. Deployment assumptions

No deployment configuration exists in the repository and none is published by the source
site. **Assumption adopted:** the rebuild targets a **static host / CDN** (Astro `output:
'static'`), since the entire public English site is content that can be pre-rendered. This
choice is documented in `/docs/deployment.md`, is host-agnostic, and is reversible — the
one behaviour requiring host cooperation is 301 redirects for legacy URLs, for which
configuration is provided for Netlify, Vercel, Cloudflare Pages and Apache/Nginx.

No backend, database, CMS or API is required. The source site exposes no public API worth
consuming; the three AJAX fragment endpoints are build-time extraction sources only.

---

## 14. Gate

Reconnaissance is complete. Repository state, toolchain, source delivery stack, route map,
content endpoints, payload profile, design signals and the full defect baseline are
established. Proceeding to **Phase 1 — public site crawl**.
