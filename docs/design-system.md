# Design system

Extracted from the public source site, then made accessible and consistent.
Tokens live in `src/styles/tokens.css`; `tools/lint.mjs` fails the build on a
hard-coded colour in a component, so contrast stays auditable in one file.

## Colour

Two signals exist in the source, and both are honoured.

### Corporate identity

`/about/ci` states: *"A red color symbolizes the benefits of bright and abundant
nature, which is a representative color of Nongshim... The secondary color is
orange that expresses the warmth of the earth."* The exact values were sampled
from the official CI artwork (`color_system.png`).

| Token | Value | Role |
| --- | --- | --- |
| `--color-brand-red` | `#df0029` | Corporate primary. The SHIN heading, the theme colour, the seed mark |
| `--color-brand-red-dark` | `#b30021` | Hover step |
| `--color-brand-orange` | `#e4820c` | Corporate secondary |
| `--color-brand-orange-dark` | `#b26509` | Hover step |

### Interface accent

Frequency analysis across all thirteen source stylesheets puts `#96c11f` (246
uses) and `#539a00` (169) far ahead of anything else — the green the live site
actually uses for navigation state, buttons and rules.

| Token | Value | Contrast on white | Role |
| --- | --- | ---: | --- |
| `--color-brand-primary` | `#96c11f` | 2.03:1 | Rules, borders, the dot motif, the footer top border — decoration only |
| `--color-brand-primary-dark` | `#539a00` | 3.51:1 | Non-text accents (passes the 3:1 non-text threshold) |
| `--color-brand-primary-text` | `#3f7500` | 5.59:1 | **All accent text and button grounds** |
| `--color-brand-primary-darker` | `#2f5800` | 8.34:1 | Hover step |

The two darker steps exist because the source's `#539a00` reaches only 3.51:1 —
fine as a rule, below AA as text. Adding steps rather than changing the hue keeps
the brand reading as itself while every text pairing clears AA.

### Neutrals

| Token | Value | Contrast on white |
| --- | --- | ---: |
| `--color-text-strong` | `#111111` | 18.88:1 |
| `--color-text` | `#222222` | 15.91:1 |
| `--color-text-muted` | `#5f5f5f` | 6.39:1 |
| `--color-background` | `#ffffff` | — |
| `--color-surface` | `#f6f6f6` | — |
| `--color-surface-strong` | `#f0f0f0` | — |
| `--color-surface-inverse` | `#1c1c1c` | — |
| `--color-border` | `#e4e4e4` | — |
| `--color-border-strong` | `#cccccc` | — |

The source used `#666666` for body copy (4.95:1) and lighter greys down to
`#767676` (4.1:1) for meta text. The muted token was raised to `#5f5f5f` so
every text token clears AA at every size.

### State

| Token | Value | Role |
| --- | --- | --- |
| `--color-focus` | `#0a3398` | Focus ring (10.83:1 on white) |
| `--color-link` | `#2c5f00` | Link text (7.65:1) |
| `--color-link-hover` | `#1f4300` | (11.28:1) |
| `--color-brand-blue` | `#0a3398` | The source's investors-section blue |

### Dark mode

Not implemented. The source is a single light-mode brand experience and its
product photography is shot on white; inventing a dark palette that was never
designed would change the brand rather than reproduce it. The page declares
`color-scheme: light` so the browser does not force one.

## Typography

**Red Hat Display** — the source's display face, SIL OFL 1.1 licensed, so it can
be redistributed. Self-hosted as a single variable WOFF2 covering weights
400–700 in the Latin subset: **30 KB**, replacing three uncompressed TTF files.

```css
--font-display: 'Red Hat Display', 'Segoe UI', system-ui, …;
--font-body:    'Red Hat Display', 'Segoe UI', system-ui, …;
```

The fallback is a system stack, so first paint never waits on the network.

### Scale

The source used 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 30, 36, 76 and
96 px — sixteen sizes with no system. This is eight fluid steps:

| Token | Value | Renders |
| --- | --- | --- |
| `--text-xs` | `0.75rem` | 12 px |
| `--text-sm` | `0.875rem` | 14 px |
| `--text-base` | `1rem` | 16 px |
| `--text-md` | `1.125rem` | 18 px |
| `--text-lg` | `clamp(1.125rem, 0.4vw + 1.03rem, 1.375rem)` | 18 → 22 px |
| `--text-xl` | `clamp(1.375rem, 1vw + 1.15rem, 1.75rem)` | 22 → 28 px |
| `--text-2xl` | `clamp(1.625rem, 1.8vw + 1.25rem, 2.25rem)` | 26 → 36 px |
| `--text-3xl` | `clamp(2rem, 3.2vw + 1.3rem, 3.25rem)` | 32 → 52 px |
| `--text-4xl` | `clamp(2.25rem, 5vw + 1.2rem, 4.75rem)` | 36 → 76 px |

Fluid steps compress on a 320 px viewport rather than overflowing, which is what
`npm run browser-test` verifies at ten widths.

Line heights: `1.15` tight, `1.3` snug, `1.6` normal, `1.75` relaxed.
Headings use `text-wrap: balance`; body copy uses `text-wrap: pretty` and a
`68ch` measure.

## Spacing

A 4 px base, eleven steps from `0.25rem` to `6.5rem`, plus one fluid token for
section rhythm:

```css
--space-section: clamp(2.5rem, 6vw, 6rem);
```

Section spacing compresses on small screens rather than scaling linearly, which
is what the source's fixed 80–120 px gaps did badly on a phone.

## Layout

| Token | Value |
| --- | --- |
| `--container-max` | `1280px` (matches the source) |
| `--container-narrow` | `820px` (reading measure) |
| `--container-pad` | `clamp(1rem, 4vw, 2.5rem)` |
| `--header-height` | `4.5rem` |

Breakpoints are expressed in `rem` in component styles: 40rem (640 px),
48rem (768 px), 62rem (992 px), 64rem (1024 px). The header switches to its
scrolling rail at 1100 px. The source used Bootstrap 4's defaults plus bespoke
960/991 px variants inconsistently.

## Shape, elevation, motion

```css
--radius-sm: 4px;   --radius-md: 8px;   --radius-lg: 16px;  --radius-pill: 999px;
--shadow-sm / --shadow-md / --shadow-lg
--ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
--duration-fast: 120ms;  --duration-base: 220ms;  --duration-slow: 400ms;
```

Under `prefers-reduced-motion: reduce` every duration token collapses to 1 ms.

## Components

| Component | File | Notes |
| --- | --- | --- |
| Header | `components/global/Header.astro` | `<details>` disclosures; a scrolling rail below 1100 px |
| Footer | `components/global/Footer.astro` | Full section graph, socials, group and brand sites |
| Breadcrumbs | `components/global/Breadcrumbs.astro` | Current page is text, not a self-link |
| Page hero | `components/ui/PageHero.astro` | Fixed dark scrim so contrast never depends on the photograph |
| Logo | `components/ui/Logo.astro` | The official raster, 2× density, never the LCP |
| LCP image | `components/ui/LcpImage.astro` | Renders a `prepareLcpImage()` result |
| Product card | `components/products/ProductCard.astro` | Whole card is one link; configurable heading level |
| Category page | `components/products/CategoryPage.astro` | |
| Product detail | `components/products/ProductDetail.astro` | |
| Catalogue filter | `components/products/ProductFilter.astro` | Hidden until its script runs |
| Recipe card | `components/recipes/RecipeCard.astro` | |
| Recipe index | `components/recipes/RecipeIndex.astro` | Path-based pagination with rel prev/next |
| Section body | `components/company/SectionBody.astro` | Rebuilds lists, definition lists and tables from flattened blocks |

### Brand motifs preserved

- **The rule-and-dot.** The source's `.nongshim-box` — a green rule with a red
  dot — reproduced in pure CSS as `.brand-rule` (two pseudo-elements, no markup).
- **The large "best product" card.** The source gave certain products a wide
  two-column treatment; kept, as a grid span on the first featured card.
- **The seed symbol.** Used unmodified in the footer and as the favicon set.

## Utilities

`.container`, `.container--narrow`, `.section`, `.grid--cards`,
`.grid--wide-cards`, `.stack`, `.prose`, `.eyebrow`, `.lede`, `.brand-rule`,
`.button` (+ `--primary`, `--outline`), `.scroll-x`, `.visually-hidden`,
`.skip-link`.

That is the whole utility surface. Everything else is component-scoped, so a
page ships only the CSS it uses.

## Rules the linter enforces

- No hard-coded colour in a component
- No `<Image>` without `widths`/`width`/`densities`
- No `<Image widths>` without a matching `sizes`
- No `<Image>` without `alt`
- No positive `tabindex`
- No `user-scalable=no` or `maximum-scale=1`
- No `target="_blank"` without `rel`
- No `javascript:` href
- No `innerHTML` assignment without escaping
- No plain-`http://` URL
- No `console.log` in shipped code
