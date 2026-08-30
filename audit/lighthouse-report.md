# Lighthouse report

Generated 2026-08-30 by `npm run lighthouse`, against `dist/`
served over HTTP with brotli and the production cache headers. Mobile runs use
Lighthouse's standard 4x CPU slowdown and Slow 4G throttling.

Each figure is the **median of 3 runs**; a throttled mobile run varies by
several points between repeats, so a single run is not reportable.

## Scores

| Page | Form factor | Performance | Accessibility | Best practices | SEO |
| --- | --- | ---: | ---: | ---: | ---: |
| Homepage | mobile | 99 | 100 | 100 | 100 |
| Homepage | desktop | 100 | 100 | 100 | 100 |
| Product listing | mobile | 96 | 100 | 100 | 100 |
| Product listing | desktop | 100 | 100 | 100 | 100 |
| Product category | mobile | 99 | 100 | 100 | 100 |
| Product category | desktop | 100 | 100 | 100 | 100 |
| Product detail | mobile | 100 | 100 | 96 | 100 |
| Product detail | desktop | 100 | 100 | 100 | 100 |
| Recipe listing | mobile | 99 | 100 | 100 | 100 |
| Recipe listing | desktop | 100 | 100 | 100 | 100 |
| Recipe detail | mobile | 100 | 100 | 100 | 100 |
| Recipe detail | desktop | 100 | 100 | 100 | 100 |
| Company page | mobile | 99 | 100 | 100 | 100 |
| Company page | desktop | 100 | 100 | 100 | 100 |
| Character page | mobile | 99 | 100 | 100 | 100 |
| Character page | desktop | 100 | 100 | 96 | 100 |

**Targets:** Performance 95+, Accessibility 95+, Best practices 95+, SEO 100.

All pages meet every target.

## Core Web Vitals

Lab measurements. Field data (CrUX) will differ; see docs/performance.md for the
post-launch monitoring plan.

| Page | Form factor | FCP | LCP | CLS | TBT | Speed Index |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Homepage | mobile | 1028 ms | 1960 ms | 0.000 | 11 ms | 1028 ms |
| Homepage | desktop | 278 ms | 450 ms | 0.000 | 0 ms | 278 ms |
| Product listing | mobile | 1764 ms | 2414 ms | 0.000 | 36 ms | 2548 ms |
| Product listing | desktop | 368 ms | 493 ms | 0.000 | 0 ms | 368 ms |
| Product category | mobile | 1188 ms | 2112 ms | 0.000 | 81 ms | 1188 ms |
| Product category | desktop | 324 ms | 472 ms | 0.000 | 0 ms | 324 ms |
| Product detail | mobile | 1054 ms | 1811 ms | 0.000 | 15 ms | 1054 ms |
| Product detail | desktop | 274 ms | 431 ms | 0.000 | 0 ms | 274 ms |
| Recipe listing | mobile | 1188 ms | 2107 ms | 0.000 | 82 ms | 1188 ms |
| Recipe listing | desktop | 286 ms | 431 ms | 0.000 | 0 ms | 305 ms |
| Recipe detail | mobile | 1042 ms | 1808 ms | 0.000 | 16 ms | 1042 ms |
| Recipe detail | desktop | 270 ms | 447 ms | 0.000 | 0 ms | 270 ms |
| Company page | mobile | 1182 ms | 1580 ms | 0.000 | 122 ms | 1185 ms |
| Company page | desktop | 276 ms | 389 ms | 0.000 | 0 ms | 276 ms |
| Character page | mobile | 1187 ms | 1882 ms | 0.000 | 18 ms | 1187 ms |
| Character page | desktop | 301 ms | 409 ms | 0.000 | 0 ms | 339 ms |

**Thresholds:** LCP < 2500 ms, CLS < 0.1, TBT < 200 ms (a lab proxy for INP).

## Remaining Lighthouse audits below 1.0

| Audit | Score | Detail | Pages |
| --- | ---: | --- | --- |
| Network dependency tree | 0.00 |  | 9 |
| Serves images with low resolution | 0.00 |  | 2 |
| Document request latency | 0.50 | Est savings of 48 KiB | 16 |
| Improve image delivery | 0.50 | Est savings of 29 KiB | 14 |
| Speed Index | 0.78 | 4.2 s | 1 |
| Max Potential First Input Delay | 0.83 | 150 ms | 8 |
| First Contentful Paint | 0.83 | 2.0 s | 5 |
| Total Blocking Time | 0.98 | 110 ms | 3 |
| Largest Contentful Paint | 0.99 | 1.8 s | 8 |
| Time to Interactive | 0.99 | 2.0 s | 4 |
