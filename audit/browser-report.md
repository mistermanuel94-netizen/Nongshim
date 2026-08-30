# Browser regression report

Generated 2026-08-30 by `npm run browser-test` in
headless Chrome against `dist/`.

These are the checks static analysis cannot make: computed layout at real
widths, keyboard focus behaviour, reflow, and what the site does with
JavaScript disabled.

## Results

- PASS — No horizontal overflow across 13 pages x 10 widths
- PASS — Reflow at 400% zoom (320px equivalent) with no horizontal scroll
- PASS — Text-spacing overrides cause no clipping or overflow
- PASS — Keyboard focus order and focus visibility
- PASS — Interactive components: menus, Escape, catalogue filter
- PASS — Site is complete and navigable with JavaScript disabled
- PASS — No console errors or failed same-origin requests
- PASS — Unknown paths return HTTP 404 — got 404
- PASS — The 404 response renders the custom error page — h1 was "That page does not exist"


## Coverage

| Check | Scope | WCAG |
| --- | --- | --- |
| Horizontal overflow | 13 pages × 10 widths (320, 360, 375, 390, 414, 768, 1024, 1280, 1440, 1920 px) | 1.4.10 |
| Reflow at 400% zoom | 8 templates at a 320 px equivalent viewport | 1.4.10 |
| Text-spacing overrides | 6 templates with 1.5 line-height, 0.12em letter, 0.16em word, 2em paragraph | 1.4.12 |
| Keyboard focus | 6 templates, 40 tab stops each: skip link first, document order, visible ring | 2.1.1, 2.4.3, 2.4.7 |
| Interactive components | Header disclosure open/Escape, catalogue filter narrowing | 2.1.1, 2.1.2 |
| No JavaScript | Catalogue completeness, SHIN content, navigation | — |
| Console errors | All 13 templates | — |
| Error status | Unknown path returns 404 with the custom page | — |

## Without JavaScript

| Page | Observed |
| --- | --- |
| `/products/` | 68 products rendered; filter correctly stays hidden; 5 category links |
| `/shin/` | h1 "SHIN", 8 profile rows, 39 gallery images |
| `/` | 80 navigation links |

## Error handling

Requesting `/this-page-does-not-exist/` returned **HTTP 404** and rendered
"That page does not exist". The page is never served with a 200 status.
