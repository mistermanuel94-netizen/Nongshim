# Search Console checklist

Post-launch verification for Google Search Console and Bing Webmaster Tools.
The site is standards-based; nothing here is Google-specific beyond the tool.

## Day 0 — before announcing the launch

1. **Verify the property.** Use the DNS TXT method for a domain property so it
   covers `http`, `https` and every subdomain in one place.
2. **Confirm `SITE_URL` was correct at build time.**
   ```bash
   curl -s https://eng.nongshim.com/ | grep -o '<link rel="canonical"[^>]*>'
   ```
   A wrong value here is the single most damaging misconfiguration available;
   fix and redeploy before submitting anything.
3. **Submit the sitemap:** `https://eng.nongshim.com/sitemap-index.xml`.
   Expect 221 URLs discovered.
4. **Fetch `robots.txt`** in the Search Console tester. Confirm it is served
   (the source returned 404) and that the sitemap line resolves.
5. **Spot-check redirects** with the commands in `docs/deployment.md`. Test at
   least one of each class: a recipe (`?recipeId=`), a paginated recipe
   (`?page=3&recipeId=`), a product fragment (`?brandId=`), a variant
   (`?prodCode=`), a category tab (`?tabType=`), and the apex `/main/index`.
6. **Confirm a missing path returns 404**, not 200:
   ```bash
   curl -sI https://eng.nongshim.com/no-such-page/ | head -1
   ```
7. **Run the Rich Results Test** on one product page and one recipe page.
   Expect `Product` and `Recipe` to validate with no errors. Google may warn
   about missing recommended fields (`offers`, `aggregateRating`, `prepTime`) —
   **those warnings are correct and expected**: the source publishes none of
   that data, so emitting it would be fabrication. Do not "fix" them.

## Week 1

| Report | What to expect | Act if |
| --- | --- | --- |
| Sitemaps | 221 discovered, rising coverage | Discovered count is far below 221 |
| Pages → Indexed | Rising from 0 | Flat after 7 days with no crawl activity |
| Pages → Page with redirect | Rising sharply as legacy URLs are re-crawled | It stays at 0 — the host redirect config probably did not apply |
| Pages → Not found (404) | Small and falling | It rises. Check query-string URLs first; on Cloudflare Pages this means Bulk Redirects was not loaded |
| Pages → Duplicate without canonical | Should stay 0 | Anything appears |
| Enhancements → Products / Recipes | Items detected | Errors appear |

## Month 1

- **Core Web Vitals** (field data, 28-day rolling). Compare against the lab
  figures in `audit/lighthouse-report.md`. A large gap usually means CDN
  configuration rather than page code — verify brotli and the `immutable`
  cache headers actually reached production.
- **Performance → Queries.** Watch for product and recipe queries appearing for
  the first time. These were previously impossible to rank for, because the
  pages did not exist.
- **Performance → Pages.** Product and recipe pages should start accruing
  impressions. If they do not after four weeks with pages indexed, the issue is
  content or competition, not technical.
- **Legacy URL decay.** "Page with redirect" should peak and then decline as
  Google consolidates onto the new URLs. Keep the redirects in place
  permanently regardless — a 301 is only obeyed while it is served.

## Bing Webmaster Tools

Same submission steps. Bing's URL Inspection and its Markup Validator are
worth running once for the structured data, since it parses slightly
differently from Google. IndexNow is supported by Bing if faster re-indexing
after content updates is wanted; it would be a small addition to the deploy
step.

## Ongoing

- Re-run `npm run lighthouse` before every deploy; it fails below target.
- Re-run `npm run audit` after every content refresh.
- Re-submit the sitemap after a refresh that changes the URL set.
- If the catalogue grows, new products and recipes generate their own routes,
  redirects and sitemap entries — but the counts asserted in
  `tests/content.test.ts` will fail until updated, which is deliberate.

## What not to do

- Do not add `offers`, `aggregateRating` or `nutrition` to satisfy a Search
  Console "recommended field" warning. The data does not exist publicly.
- Do not submit `/search/` or the 404 for indexing; both are `noindex` by
  design.
- Do not remove redirects once traffic to the legacy URLs falls. Inbound links
  from outside the site never expire.
