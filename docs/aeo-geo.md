# Answer Engine and Generative Engine Optimisation

## The problem this solves

Before the rebuild, an answer engine asked *"What is Shin Ramyun?"* could not
learn anything from `eng.nongshim.com`. The product existed only as an AJAX
fragment injected into a grid; there was no URL to cite, no heading to extract
and no structured data to parse. The same was true of all 68 products and of
SHIN, the brand character, whose entire story sat inside a `display:none`
JavaScript modal.

Nongshim is the authoritative source for facts about Nongshim. When its own site
cannot be read, models answer from third-hand sources instead.

## The principle

Everything here is the same work as making the site genuinely useful to people.
There are no AI-specific tricks — no cloaked text, no hidden blocks, no content
written for machines. The site is optimised for retrieval by being **complete,
factual, well-structured and in the HTML**.

## What an answer engine can now extract

Ten questions, and where the site answers each in its initial HTML:

| Question | Page | Where the answer sits |
| --- | --- | --- |
| What is Nongshim? | `/` | First `<h1>`, then the first paragraph of `<main>` |
| What products does Nongshim make? | `/products/` | 68 named products, all in the HTML, plus an `ItemList` |
| What categories exist? | `/` and `/products/` | Four category cards with counts and descriptions |
| What is Shin Ramyun? | `/products/shin-ramyun/` | `<h1>`, tagline, spec table, then the product's own description under `About Shin Ramyun` |
| What sizes does Shin Ramyun come in? | same | `Pack formats` section: three variants with weights and release dates |
| Who is SHIN? | `/shin/` | `<h1>SHIN</h1>` then the character's own first-person introduction |
| What snacks does Nongshim offer? | `/products/snacks/` | 24 named products with a count sentence |
| What recipes are available? | `/recipes/` | 101 recipes with summaries; paginated in crawlable paths |
| How do I make Chapaguri? | `/recipes/chapaguri/` | Ingredient list and numbered steps, each step a text node |
| Where does Nongshim operate? | `/about/global/` | Nine subsidiaries with descriptions, addresses and phone numbers |
| When was Nongshim founded? | `/`, `/about/history/` | Stated in the homepage lede; the timeline runs 1965–2020 |

## Techniques used

### The answer sits next to the heading

Every page states its subject in the `<h1>` and answers the obvious question in
the first paragraph after it. On `/shin/`:

```html
<h1>SHIN</h1>
<p class="lede">Hello! My name is SHIN, I'm traveling around the world to
deliver spicy happiness to people everywhere.</p>
<p>SHIN is the brand character of <a href="/products/shin-ramyun/">Shin
Ramyun</a>, Nongshim's best-known instant noodle.</p>
```

The second sentence exists because the source never states the relationship in
text anywhere — it was implied by the modal's placement on the catalogue page.
Stating a relationship the site itself demonstrates is not inventing a fact.

### Facts in tables, prose in prose

SHIN's profile is an eight-row table with `<th scope="row">` labels (Name,
Dream, Hobby, Likes, Personality, Features, Strength, Weakness). Product
specifications are a `<dl>` of Net weight / Released / Certification. These are
attribute–value pairs and are marked up as such, which is both better for
screen readers and unambiguous to parse.

### Text that was an image is now text

The source rendered the word "SHIN" as `shin-txt-icon.png` **inside sentences** —
so the character's story read, to any parser, as a series of fragments with
holes in them. Those images are replaced with the literal text they depict.

### No important content behind interaction

| Content | Source | Now |
| --- | --- | --- |
| Product detail | AJAX on click | Static page |
| Product categories | JS tab switch | Four pages |
| SHIN's story and profile | `display:none` modal | A page with headings |
| SHIN's 39 illustrations | Swiper carousel | A plain lazy-loaded grid |
| Company history | JS timeline widget | Semantic year-by-year list |
| Video transcripts | — | `<details>` (content is in the DOM, collapsed) |

A `<details>` element keeps its content in the DOM and in the accessibility
tree, so collapsing a transcript hides it visually without hiding it from
retrieval. A JavaScript modal does neither.

### Video transcripts as text

`/pr/tv/` publishes 31 films. Video is opaque to retrieval, so the page renders
each film's published English transcript as real paragraphs. That page is the
only place on the web where those transcripts are readable as text.

### Consistent entity naming

One name per entity, everywhere: in the `<h1>`, in the `<title>`, in the
breadcrumb, in link anchors, and in JSON-LD `name`. The audit verifies that
every `Product.name` and every `Recipe` instruction in the structured data
appears verbatim in the rendered body, so the machine-readable and
human-readable versions of a page cannot drift apart.

### Stable, meaningful URLs

`/products/shin-ramyun/` is self-describing and will not change. A citation that
resolves permanently is worth more than one that a CMS re-numbers.

### Explicit counts and scope

Pages state their own scope in text: *"Nongshim publishes 24 products in this
category"*, *"101 recipes built on Nongshim noodles"*, *"9 overseas
subsidiaries"*. This lets a model state a bounded fact rather than guess at
completeness, and every count is computed from the content rather than typed.

## AI crawler policy

`robots.txt` allows GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User,
PerplexityBot, Google-Extended, Applebot-Extended, CCBot and
meta-externalagent, each with `/search/` disallowed.

**The rationale.** This site is public brand, product and company information
whose value increases when answer engines can cite it accurately. The
alternative is not "models say nothing about Nongshim" — it is "models describe
Nongshim from retailer listings, aggregators and forum posts". Blocking the
authoritative source does not remove the topic from the index; it removes the
authority from the answer.

This is a publishing decision, not a technical one, and it belongs to Nongshim.
It is a single list in `src/pages/robots.txt.ts` and is trivially reversible.
Note that `Google-Extended` controls Gemini training and grounding but does
**not** affect Google Search indexing or AI Overviews; those follow the ordinary
`Googlebot` rules.

## Verification

`tools/audit-seo.mjs` enforces the properties this depends on, and fails the
build on any of:

- structured data naming something the page body does not contain
- a recipe instruction in JSON-LD that is not in the page text
- an image whose alt text is not in the page's language
- a page whose subject is not in an `<h1>`
- important content reachable only through a link with no accessible name

The build ships no third-party script, so there is no execution requirement to
read any page. Every fact listed in the table above is present in `curl` output.
