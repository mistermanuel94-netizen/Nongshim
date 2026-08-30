# Performance report

Generated 2026-08-30 by `npm run perf` against `dist/`.

Text assets are measured **Brotli-compressed**, which is what a CDN serves.
Image bytes are the exact file a browser would pick from `srcset`/`sizes` at
each viewport, not the largest candidate.

## Initial transfer per template

"Initial" is the document plus everything that accompanies first paint: CSS,
JavaScript, the preloaded font, and images not marked `loading="lazy"`.

| Template | Viewport | Requests | HTML (br) | CSS | JS | Font | Eager images | **Initial total** |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Homepage | mobile | 4 | 10.1 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 34.6 KB | **74.7 KB** |
| Homepage | desktop | 4 | 10.1 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 34.6 KB | **74.7 KB** |
| Product listing | mobile | 4 | 15.6 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 34.6 KB | **80.1 KB** |
| Product listing | desktop | 4 | 15.6 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 34.6 KB | **80.1 KB** |
| Product category | mobile | 4 | 11.8 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 34.6 KB | **76.3 KB** |
| Product category | desktop | 4 | 11.8 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 18.0 KB | **59.7 KB** |
| Product detail | mobile | 4 | 9.5 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 25.3 KB | **64.7 KB** |
| Product detail | desktop | 4 | 9.5 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 25.3 KB | **64.7 KB** |
| Recipe listing | mobile | 4 | 11.2 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 32.2 KB | **73.3 KB** |
| Recipe listing | desktop | 4 | 11.2 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 19.6 KB | **60.7 KB** |
| Recipe detail | mobile | 4 | 8.4 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 38.6 KB | **77.0 KB** |
| Recipe detail | desktop | 4 | 8.4 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 38.6 KB | **77.0 KB** |
| Company page | mobile | 3 | 8.4 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **40.7 KB** |
| Company page | desktop | 3 | 8.4 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **40.7 KB** |
| History timeline | mobile | 3 | 10.2 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **42.5 KB** |
| History timeline | desktop | 3 | 10.2 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **42.5 KB** |
| Character page | mobile | 4 | 10.2 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 17.5 KB | **57.7 KB** |
| Character page | desktop | 4 | 10.2 KB | 0.0 KB | 0.0 KB | 30.0 KB | 2 · 12.4 KB | **52.6 KB** |
| Global network | mobile | 3 | 11.3 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **43.6 KB** |
| Global network | desktop | 3 | 11.3 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **43.6 KB** |
| Search | mobile | 3 | 8.1 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **40.4 KB** |
| Search | desktop | 3 | 8.1 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **40.4 KB** |
| Error page | mobile | 3 | 6.5 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **38.8 KB** |
| Error page | desktop | 3 | 6.5 KB | 0.0 KB | 0.0 KB | 30.0 KB | 1 · 2.4 KB | **38.8 KB** |

## Deferred weight

Lazy images load only as they approach the viewport, so they do not affect LCP.

| Template | Viewport | Lazy images | Lazy bytes | DOM nodes | JSON-LD |
| --- | --- | ---: | ---: | ---: | ---: |
| Homepage | mobile | 18 | 445.1 KB | 569 | 1.5 KB |
| Homepage | desktop | 18 | 237.2 KB | 569 | 1.5 KB |
| Product listing | mobile | 71 | 1293.5 KB | 1037 | 9.6 KB |
| Product listing | desktop | 71 | 1269.7 KB | 1037 | 9.6 KB |
| Product category | mobile | 41 | 756.2 KB | 756 | 6.1 KB |
| Product category | desktop | 41 | 732.3 KB | 756 | 6.1 KB |
| Product detail | mobile | 11 | 159.9 KB | 517 | 2.9 KB |
| Product detail | desktop | 11 | 159.5 KB | 517 | 2.9 KB |
| Recipe listing | mobile | 26 | 837.0 KB | 632 | 4.7 KB |
| Recipe listing | desktop | 26 | 392.6 KB | 632 | 4.7 KB |
| Recipe detail | mobile | 9 | 29.7 KB | 454 | 2.9 KB |
| Recipe detail | desktop | 9 | 29.3 KB | 454 | 2.9 KB |
| Company page | mobile | 4 | 4.3 KB | 478 | 1.4 KB |
| Company page | desktop | 4 | 3.8 KB | 478 | 1.4 KB |
| History timeline | mobile | 9 | 42.1 KB | 869 | 1.4 KB |
| History timeline | desktop | 9 | 24.7 KB | 869 | 1.4 KB |
| Character page | mobile | 45 | 630.4 KB | 531 | 1.6 KB |
| Character page | desktop | 45 | 559.5 KB | 531 | 1.6 KB |
| Global network | mobile | 24 | 287.6 KB | 569 | 4.3 KB |
| Global network | desktop | 24 | 145.4 KB | 569 | 4.3 KB |
| Search | mobile | 4 | 4.3 KB | 409 | 1.0 KB |
| Search | desktop | 4 | 3.8 KB | 409 | 1.0 KB |
| Error page | mobile | 4 | 4.3 KB | 402 | 0.0 KB |
| Error page | desktop | 4 | 3.8 KB | 402 | 0.0 KB |

## Budget

| Metric | Budget | Worst observed | Status |
| --- | --- | --- | --- |
| Initial transfer, mobile | < 250 KB | 80.1 KB (Product listing) | pass |
| JavaScript per page | < 30 KB | 2.3 KB | pass |
| DOM nodes | < 1500 | 1037 | pass |
| Requests, first paint | < 15 | 4 | pass |
| Third-party scripts | 0 | 0 | pass |

## Build output

- Total `dist/` size: 121.5 MB across 2694 files
- Largest files:

  - 1737.9 KB — `dist/_assets/main-visual-way-627c9c80.CItiYAyH.png`
  - 1584.3 KB — `dist/_assets/1460439611663-20a74d8f.CA6gy9ai.jpg`
  - 1582.4 KB — `dist/_assets/1460439628533-87a8dfd7.PBabWtsW.jpg`
  - 1568.5 KB — `dist/_assets/img-0467-f5814389.CmDsFl7_.jpg`
  - 1480.6 KB — `dist/_assets/main-together-visual-9cf89470.DwbJeCH9.png`
  - 1461.8 KB — `dist/_assets/main-customer-visual-b1ba87db.BJR0UjVC.png`
  - 1417.8 KB — `dist/_assets/main-visual-championship-93525a43.Dy9NPCcY.png`
  - 1285.0 KB — `dist/_assets/main-visual-planet-01-ed8f35a7.DuMSMkbi.png`
  - 1243.3 KB — `dist/_assets/main-visual-governance-01-cd682d76.BuRsFofQ.png`
  - 1226.9 KB — `dist/_assets/main-env-visual-58043f2f.qUoN1F_P.png`
