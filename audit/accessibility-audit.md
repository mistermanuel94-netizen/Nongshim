# Accessibility audit (machine-generated summary)

Narrative analysis, including what has **not** been tested, is
`docs/accessibility.md`. Raw results: `audit/a11y-audit.json` and
`audit/browser-report.md`.

## Commands

```bash
npm run a11y-audit     # static analysis over dist/
npm run browser-test   # headless Chrome: layout, focus, reflow, no-JS
npm run lighthouse     # Lighthouse accessibility category
```

## Result

```
a11y-audit    223 pages, 18 colour pairings, 0 violations
browser-test  9 checks, 0 failures
lighthouse    accessibility 100 on every page, mobile and desktop
```

## Static analysis coverage

| Area | Checks |
| --- | --- |
| Landmarks | exactly one `<main>`; `<header>`; `<footer>`; a skip link targeting `#main`; every `<nav>` uniquely named |
| Headings | exactly one `<h1>`; no skipped level; no empty heading |
| Links and controls | every link and button has an accessible name (text, `aria-label`, `aria-labelledby`, or a child image's alt); no "click here"; `target="_blank"` carries `rel` |
| Images | `alt` present; alt in the page language; alt under 180 characters |
| Forms | every control labelled by `<label for>`, `aria-label`, `aria-labelledby` or wrapping |
| Tables | header cells present; every `<th>` has `scope` |
| Frames | every `<iframe>` titled |
| Identity | no duplicate `id` |
| Zoom | viewport permits pinch-zoom |
| ARIA | no role duplicating its native element; nothing focusable inside `aria-hidden` |
| Disclosure | no `<details>` without `<summary>` |
| Colour | all 18 pairings the stylesheets produce, against 4.5:1 or 3:1 as appropriate |

## Browser coverage

| Check | Scope |
| --- | --- |
| Horizontal overflow | 13 templates × 10 widths (320–1920 px) = 130 combinations |
| Reflow (SC 1.4.10) | 8 templates at a 320 px equivalent viewport |
| Text spacing (SC 1.4.12) | 6 templates with the full override set |
| Focus order and visibility | 6 templates, 40 tab stops each |
| Interactive components | header disclosure open/Escape, catalogue filter narrowing |
| No JavaScript | catalogue completeness, SHIN content, navigation |
| Console errors | all 13 templates |
| Error status | unknown path returns 404 with the custom page |

## Contrast ratios

| Pairing | Ratio | Needs |
| --- | ---: | ---: |
| Body text on page | 15.91:1 | 4.5 |
| Body text on surface | 14.72:1 | 4.5 |
| Headings on page | 18.88:1 | 4.5 |
| Muted text on page | 6.39:1 | 4.5 |
| Muted text on surface | 5.91:1 | 4.5 |
| Link text | 7.65:1 | 4.5 |
| Link hover | 11.28:1 | 4.5 |
| Accent text on page | 5.59:1 | 4.5 |
| Accent text on surface | 5.17:1 | 4.5 |
| Primary button label | 5.59:1 | 4.5 |
| Primary button hover | 8.34:1 | 4.5 |
| Hero eyebrow on darkest scrim | 5.22:1 | 4.5 |
| Hero heading on darkest scrim | 11.03:1 | 4.5 |
| SHIN heading (large text) | 5.04:1 | 3.0 |
| Focus ring on page | 10.83:1 | 3.0 |
| Focus ring on surface | 10.02:1 | 3.0 |
| Source green as a rule (non-text) | 3.51:1 | 3.0 |

## Not tested

Manual screen-reader passes, a human keyboard walkthrough, a cognitive review
and non-Chromium browsers. See `docs/accessibility.md` for the full list — these
are genuine gaps in verification, not passing results.
