# URL Map

Generated 2026-08-30 from `data/products.json`, `data/recipes.json`
and `audit/site-inventory.json`. This file is derived — edit `tools/ia.mjs`, not this.

## Policy

1. **Preserve** a source path when it is already clean, descriptive and indexable.
   All of `/about/*`, `/sustainability/*`, `/pr/*`, `/investors/*` and `/contact/*`
   keep their paths; only a trailing slash is added for consistency.
2. **Replace** a source route when it is query-driven, non-descriptive, or exposes no
   URL at all. Products and recipes fall here.
3. **Every** replaced URL gets a 301 with a stated reason. No redirect targets another
   redirect.
4. Trailing slashes are canonical site-wide (`trailingSlash: 'always'`).

## New route inventory

| Page type | Count |
| --- | --- |
| recipe-detail | 101 |
| product-detail | 68 |
| section | 40 |
| recipe-listing | 5 |
| product-category | 4 |
| home | 1 |
| product-listing | 1 |
| character | 1 |
| search | 1 |
| error | 1 |
| **Total** | **223** |

## Section hierarchy

```
/                                        Home
├── /products/                           Catalogue index (68 products)
│   ├── /products/instant-noodles/       38 products
│   ├── /products/snacks/                24 products
│   ├── /products/beverages/             3 products
│   ├── /products/home-meal-replacement/ 3 products
│   └── /products/{slug}/                Product detail, variants as #anchors
├── /recipes/                            Recipe index (101 recipes)
│   ├── /recipes/page/{2..7}/            Crawlable pagination
│   └── /recipes/{slug}/                 Recipe detail
├── /shin/                               SHIN character (new — was a JS modal)
├── /about/                              Company
│   ├── /about/overview/
│   ├── /about/profile/mission/          Management philosophy
│   ├── /about/profile/way/              The Nongshim Way
│   ├── /about/history/                  1965–2020 timeline
│   ├── /about/ci/                       Corporate identity
│   ├── /about/global/                   Global network (9 subsidiaries)
│   └── /about/group/{11 affiliates}/
├── /sustainability/                     12 pages
├── /press/                              PR
│   ├── /press/baduk/
│   └── /pr/tv/                          Video library (31 videos)
├── /investors/                          4 pages
├── /contact/                            3 pages
├── /search/
└── /404
```

## Legacy paths observed in the crawl

- `/`
- `/about/ci`
- `/about/globalNongshim`
- `/about/group`
- `/about/group/holdings`
- `/about/group/hotelNongshim`
- `/about/group/megaMart`
- `/about/group/nds`
- `/about/group/nongshimCommunication`
- `/about/group/nongshimDevelopment`
- `/about/group/nongshimEngineering`
- `/about/group/rfm`
- `/about/group/taekyungNongsan`
- `/about/group/youlchonChemical`
- `/about/group/youlchonFoundation`
- `/about/history`
- `/about/overview`
- `/about/profile/mission`
- `/about/profile/way`
- `/brand/main/index`
- `/contact/inquiry`
- `/contact/inquiry_check`
- `/contact/location`
- `/contact/overview`
- `/investors/finance/audit_list`
- `/investors/finance/audit_view`
- `/investors/ir/list`
- `/investors/ir/view`
- `/investors/overview`
- `/investors/report`
- `/main/index`
- `/pr/baduk`
- `/pr/overview`
- `/pr/pedia`
- `/pr/pedia/detail`
- `/pr/tv`
- `/recipe/recipe_list`
- `/recipe/recipe_view`
- `/sustainability/governance/compliance`
- `/sustainability/governance/governance`
- `/sustainability/overview`
- `/sustainability/people/safety`
- `/sustainability/people/shared`
- `/sustainability/people/social`
- `/sustainability/people/youlchon`
- `/sustainability/planet/response`
- `/sustainability/planet/sustainable`
- `/sustainability/prosperity/consumer`
- `/sustainability/prosperity/rnd`
- `/sustainability/report`
- `/www.ndscareers.com/nds_recruit/main.jsp`

## Redirects

1074 redirect rules. Full detail in `audit/redirect-map.csv`.

| Group | Rules |
| --- | --- |
| Entry point | 1 |
| Preserved paths (trailing slash / rename) | 40 |
| Product catalogue + categories | 5 |
| Product fragments -> product pages | 68 |
| Variant fragments -> anchors | 140 |
| Recipe list + pagination | 7 |
| Recipe detail (canonical + paginated duplicates) | 808 |
| Removed / consolidated source routes | 5 |

### Integrity checks

- Redirect chains: **0** (none)
- Redirects pointing at a non-existent route: **0** (none)
- Duplicate `from` values: **0**
