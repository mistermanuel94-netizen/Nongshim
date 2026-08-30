# AEO / GEO audit

An AI-retrieval assessment of the rebuilt site against the source. The strategy
and rationale are in `docs/aeo-geo.md`; this file is the audit result.

## Method

For each question, the raw HTML of the answering page was inspected — not the
rendered DOM — because no answer may depend on script execution. "Extractable"
means the fact is present as text, associated with a heading or a
label, in the initial HTTP response.

## Retrieval test

| Question | Source site | Rebuilt site | Where |
| --- | --- | --- | --- |
| What is Nongshim? | Partial — the homepage had no `<h1>` naming the company and no summary paragraph | **Extractable** | `/` — `<h1>Nongshim</h1>` then a first paragraph giving founding year, categories and best-known brands |
| When was Nongshim founded? | Buried in a JS timeline widget | **Extractable** | `/` lede; `/about/history/` timeline runs 1965–2020 |
| What products does Nongshim make? | **Not extractable** — the catalogue was AJAX-only | **Extractable** | `/products/` — 68 named products in HTML plus an `ItemList` |
| What product categories exist? | **Not extractable** — client-side tabs on one URL | **Extractable** | `/` and `/products/` — four categories with counts and descriptions; four indexable pages |
| What is Shin Ramyun? | **Not extractable** — no URL existed | **Extractable** | `/products/shin-ramyun/` — `<h1>`, tagline, spec table, then the product's own description |
| What sizes does Shin Ramyun come in? | **Not extractable** | **Extractable** | Same page — three variants with net weights and release dates |
| Who is SHIN? | **Not extractable** — a `display:none` modal with no URL, and the name rendered as an image mid-sentence | **Extractable** | `/shin/` — `<h1>SHIN</h1>`, first-person introduction, eight-field profile table |
| What snacks does Nongshim offer? | **Not extractable** | **Extractable** | `/products/snacks/` — 24 named products with a count sentence |
| What recipes are available? | Partial — titles were crawlable, but 18 were truncated by unescaped angle brackets | **Extractable** | `/recipes/` — 101 recipes with summaries, crawlable pagination |
| How do I make Chapaguri? | Partial — steps were in HTML but with no structured data and duplicate URLs | **Extractable** | `/recipes/chapaguri/` — ingredient list, numbered steps, `Recipe` JSON-LD |
| Where does Nongshim operate? | Partial — inside per-subsidiary carousels, with an untranslated Korean list | **Extractable** | `/about/global/` — nine subsidiaries with descriptions, addresses, phone numbers |
| How do I contact Nongshim? | Partial | **Extractable** | `/contact/location/` and `/contact/inquiry/` — addresses and numbers as text |

**Before: 5 of 12 answerable, 7 not. After: 12 of 12.**

## Structural audit

| Property | Check | Result |
| --- | --- | --- |
| Subject in the `<h1>` | Every page | 223/223 |
| Answer adjacent to the heading | Product, recipe, character, category, section pages | Verified by template |
| Facts as attribute–value pairs | `<dl>` or `<table>` with `<th scope>` | Product specs, variant specs, SHIN profile, office contacts, data tables |
| No text rendered only as an image | The source's "SHIN" wordmark images | Replaced with the literal text |
| No content requiring script | All 13 templates loaded with JavaScript disabled | Catalogue 68/68, SHIN heading + 8 profile rows + 39 images, 80 nav links |
| Content in collapsed regions still in the DOM | `<details>` for transcripts and maps | Yes — unlike the source's JS modals |
| Consistent entity naming | `<h1>`, `<title>`, breadcrumb, anchors, JSON-LD `name` | Enforced: the audit fails if a schema `name` is absent from the body |
| Stable URLs | Slug-based, 1,074 redirects from the legacy space | 0 chains, 0 dangling targets |
| Explicit scope statements | Computed counts in prose | "68 products", "101 recipes", "9 overseas subsidiaries", "4 audit reports covering 2025 to 2026" |

## Machine-readable coverage

| Signal | Coverage |
| --- | --- |
| Pages with JSON-LD | 222 / 223 |
| `Organization` referenced by a single `@id` | 222 nodes, one entity |
| `Product` | 68 / 68 products |
| `Recipe` | 91 / 101 recipes — the ten without a usable image are correctly omitted |
| `BreadcrumbList` | 220 pages |
| `ItemList` on collection pages | 14 |
| Verified schema/body consistency | 100% — build fails otherwise |

## Video content

31 films on `/pr/tv/`. Video is opaque to retrieval, so each film's published
English transcript is rendered as real paragraphs inside a `<details>` — in the
DOM, in the accessibility tree, and extractable. This page is the only place
these transcripts exist as text.

`VideoObject` is emitted with `name`, `url` and `embedUrl` only.
`uploadDate` and `thumbnailUrl` are **not** emitted: the source's date field is
a CMS record timestamp rather than a publication date, and no thumbnail is
published. Inventing either to qualify for a rich result would be fabrication.

## AI crawler access

| Crawler | Allowed | Notes |
| --- | --- | --- |
| GPTBot, OAI-SearchBot, ChatGPT-User | Yes | `/search/` disallowed |
| ClaudeBot, Claude-User | Yes | |
| PerplexityBot | Yes | |
| Google-Extended | Yes | Controls Gemini grounding/training only; Search indexing follows `Googlebot` |
| Applebot-Extended | Yes | |
| CCBot | Yes | |
| meta-externalagent | Yes | |

Nothing that renders a page is blocked. The rationale — that blocking the
authoritative source does not remove Nongshim from AI answers, it removes the
authority from them — is in `docs/aeo-geo.md`, and the decision is one list in
`src/pages/robots.txt.ts`.

## What was deliberately not done

No AI-specific content, no cloaked or hidden text, no invented FAQ blocks, no
llms.txt-style parallel content file, and no summary written for machines that
differs from what a person reads. Every technique above improves the site for
people first; machine readability follows from that.
