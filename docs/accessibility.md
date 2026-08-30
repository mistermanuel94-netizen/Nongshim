# Accessibility

Target: **WCAG 2.2 AA**.

Automated state: `npm run a11y-audit` reports **0 violations across 223 pages**
and 18 colour pairings. Lighthouse's accessibility category scores **100** on
every page tested, mobile and desktop.

Automated checks cannot certify conformance. What they cover, what a real
browser verifies, and what remains open are all recorded below.

## Defects inherited from the source, and their fixes

| Source defect | WCAG | Fix |
| --- | --- | --- |
| `user-scalable=no, maximum-scale=1` on every page | 1.4.4 Resize Text | Removed. `tools/lint.mjs` and the SEO audit both fail the build if it returns. |
| Korean `alt` text on the English site (39 SHIN images, plus header controls) | 3.1.1 / 1.1.1 | English alt text throughout; the audit fails on any non-English alt. |
| Korean `aria-label` on the menu and modal close buttons | 4.1.2 | English labels. |
| The logo was the `<h1>` on every page | 2.4.6 / 1.3.1 | The `<h1>` names the page's subject; exactly one per page. |
| Product cards were `<a href="javascript:void(0)">` | 2.1.1 Keyboard | Real links to real pages. |
| Content imagery delivered as CSS `background-image` — no alt at all | 1.1.1 | Real `<img>` with descriptive alt. |
| Timeline, character modal and product detail were JS-only | 1.3.1 / 4.1.2 | Semantic documents. |
| Hover-only dropdown menus | 2.1.1 | `<details>`/`<summary>`: keyboard-operable, Escape closes, expanded state announced by the platform. |
| 39-slide carousel for the SHIN gallery | 2.1.1 / 2.4.3 | A plain grid; every image reachable by scrolling. |
| Seven Google Maps iframes, none titled | 4.1.2 | One `<details>` per office, each iframe titled. |

## Structure

**Landmarks.** Every page has exactly one `<main>` (with `tabindex="-1"` so the
skip link can move focus into it), one `<header>`, one `<footer>`, and `<nav>`
elements that each carry a distinct `aria-label` — Primary, Breadcrumb, Footer,
and page-specific ones such as "Product categories" and "Jump to a decade". The
audit fails if two navigation landmarks share a name.

**Skip link.** First focusable element on every page, targets `#main`, visible
on focus.

**Headings.** One `<h1>` per page. No level is skipped anywhere — the audit
checks the whole document order. Because source pages carry decorative heading
levels (a page can jump from `h2` straight to `h4`), `SectionBody.astro` maps
the distinct source levels onto a contiguous sequence starting at `h2`, under
the page's single `h1`.

**Lists and tables.** Card grids are `<ul>`/`<li>`; the list item is the grid
cell rather than using `display: contents`, which drops the item from the
accessibility tree in several browsers. Data tables have `<caption>` and
`<th scope>`; the SHIN profile uses `scope="row"` because its headers are the
row labels.

## Colour and contrast

All 18 pairings the stylesheets actually produce are computed in
`tools/audit-a11y.mjs` and asserted against their required ratio.

| Pairing | Ratio | Needs |
| --- | ---: | ---: |
| Body text on page (`#222` on `#fff`) | 15.91:1 | 4.5 |
| Muted text on page (`#5f5f5f` on `#fff`) | 6.39:1 | 4.5 |
| Muted text on surface | 5.91:1 | 4.5 |
| Link text (`#2c5f00` on `#fff`) | 7.65:1 | 4.5 |
| Accent text (`#3f7500` on `#fff`) | 5.59:1 | 4.5 |
| Accent text on surface | 5.17:1 | 4.5 |
| Primary button label | 5.59:1 | 4.5 |
| Primary button hover label | 8.34:1 | 4.5 |
| Hero eyebrow on the darkest scrim | 5.22:1 | 4.5 |
| Hero heading on the darkest scrim | 11.03:1 | 4.5 |
| SHIN heading, large text (`#df0029`) | 5.04:1 | 3.0 |
| Focus ring on page (`#0a3398`) | 10.83:1 | 3.0 |
| Source green as a rule (non-text) | 3.51:1 | 3.0 |

Two decisions worth recording:

**The green needed darkening for text.** The source's `#539a00` reaches only
3.51:1 on white — fine as a rule or border (3:1 for non-text) but below AA for
text. The token scale gained `--color-brand-primary-text: #3f7500` (5.59:1) and
`--color-brand-primary-darker: #2f5800` (8.34:1). The source greens are kept for
decoration, so the brand still reads as itself.

**The hero scrim is fixed, not relative.** The source overlaid white text
directly on photography, so contrast depended on the picture. The rebuilt hero
paints a fixed `rgb(12 12 12 / 0.62–0.76)` gradient over the image; the lightest
possible resulting ground is `#3c3c3c`, which clears AA for the heading and the
lede regardless of what the photograph is doing.

## Keyboard

Verified automatically in headless Chrome by `npm run browser-test`, which tabs
through 40 focus stops on six templates and asserts each one. Results in
`audit/browser-report.md`.

- The skip link is the first focusable element on every page and moves focus
  into `<main>`.
- Focus order follows document order; no stop moves backwards.
- Every focus stop paints a visible focus ring.
- No positive `tabindex` exists anywhere; `tools/lint.mjs` forbids it.
- Header menus open on activation and close on Escape (asserted directly).
- The catalogue filter reveals itself, narrows the list, and announces its
  result count through `role="status" aria-live="polite"`.
- Every interactive target is at least 44×44 CSS px in the stylesheet — WCAG 2.2
  SC 2.5.8 requires 24×24, so this clears it with margin.
- Focus is never trapped: there is no modal on the site.

**Focus visibility.** A single `:focus-visible` treatment — a 3 px `#0a3398`
outline at 2 px offset — applied globally and never removed. At 10.83:1 against
the page it satisfies SC 2.4.11 (Focus Not Obscured) and 2.4.13 (Focus
Appearance).

## Images

| Kind | Treatment |
| --- | --- |
| Product packshot | `"{Product name} pack"` |
| Product card | `"{Product name} packaging"` |
| Recipe hero | `"{Recipe name}, plated and ready to serve"` |
| Recipe step | `"Step {n}: {first clause of the instruction}"`, capped at ~90 characters |
| SHIN gallery | `"SHIN character illustration, pose {n}"` |
| History entry | The published caption |
| Decorative (hero background, footer symbol) | `alt=""` plus `aria-hidden="true"` |

Recipe step alt text is deliberately the *opening clause* rather than the whole
instruction: the full text sits immediately beside the image, and a 200-character
alt is exhausting to hear and duplicates what was just read. Seven such alts were
shortened after the audit flagged them.

The audit fails on a missing `alt` attribute, on alt text containing Korean, and
on alt text over 180 characters.

## Forms

The only form that submits is the contact enquiry. Every control has a real
`<label for>`. The catalogue filter and site search have labelled inputs and
`role="search"` regions. Results and counts are announced through
`aria-live="polite"`.

The enquiry form posts to `PUBLIC_CONTACT_ENDPOINT`. When that is not
configured, the page says so plainly and gives the published phone number and
postal address — it never renders a form that silently discards input.

## Motion

`prefers-reduced-motion: reduce` collapses every transition duration token to
1 ms and disables smooth scrolling. There is no autoplaying video, no parallax
and no carousel. Hover transitions are `transform`/`opacity`/colour only, so
they stay on the compositor.

## Screen reader support

**No manual screen-reader testing has been performed on this build.** What
follows is what the markup provides and what the automated audits verify. It is
not a substitute for a listening pass, which is an open item below.

The structures a screen reader depends on are asserted by `npm run a11y-audit`
across all 223 pages:

| Page | Structure provided |
| --- | --- |
| Homepage | One `h1`; distinct navigation landmark names; card links whose accessible name is the product name |
| Product listing | A real `<ul>` of 68 items; the filter's count is announced through `role="status" aria-live="polite"` |
| Product detail | `h1`, tagline, then a `<dl>` of label/value specification pairs; each variant has its own `id` anchor |
| Recipe detail | Ingredients as a `<ul>`; each step's text is preceded by a visually-hidden "Step N:" prefix so the number is announced |
| SHIN | An eight-row profile table with `<th scope="row">` and a `<caption>` |
| History | Year headings form a navigable outline; each month is prefixed with a visually-hidden "Month:" |

## Zoom and reflow

Verified automatically in headless Chrome by `npm run browser-test` — see
`audit/browser-report.md`:

- **No horizontal page scrolling** across 13 templates at 320, 360, 375, 390,
  414, 768, 1024, 1280, 1440 and 1920 px — 130 page/width combinations.
- **Reflow at a 320 px equivalent viewport** (SC 1.4.10, the 400 % zoom case)
  produces no second scroll axis on any of eight templates.
- **Text-spacing overrides** (line-height 1.5×, letter-spacing 0.12em,
  word-spacing 0.16em, paragraph-spacing 2em) cause no clipping or overflow on
  any of six templates (SC 1.4.12).

Wide content — data tables and the SHIN profile — scrolls inside its own
`overflow-x: auto` container rather than the page. The header navigation becomes
a horizontal scrolling rail below 1100 px; every link stays in the DOM and
reachable, so nothing is hidden behind a hamburger state machine, and nothing is
hidden from crawlers either. Type uses `clamp()` tokens, so it compresses rather
than overflowing.

## Running the audit

```bash
npm run a11y-audit
```

Static analysis over `dist/`: landmarks, heading order, link and control
accessible names, form labelling, table semantics, alt text and language,
duplicate IDs, zoom, redundant ARIA roles, `aria-hidden` wrapping focusable
content, `<details>` without `<summary>`, and all colour pairings. Exit code 1
on any violation.

## Open items

These are the checks that automation cannot make. **They have not been performed
on this build** and should be completed before launch.

| Item | Status |
| --- | --- |
| Screen-reader pass (NVDA, JAWS, VoiceOver) | **Not performed.** Required to confirm reading order, table navigation and live-region announcements in practice. |
| Manual keyboard walkthrough by a person | **Not performed.** The automated pass covers order and focus visibility, not whether the experience is sensible. |
| Cognitive-accessibility review | **Not performed.** Recommended, particularly for the recipe step sequence and the catalogue filter. |
| Testing with browser zoom in a real browser UI | **Not performed.** The automated reflow test emulates the viewport rather than using browser zoom. |
| Third-party map iframe | Google Maps' own accessibility is outside this project's control. It is behind a `<details>`, titled, and the address is always available as text above it, so no information depends on the map. |
| YouTube player | Same reasoning. Each film's transcript is published as text on the page. |
