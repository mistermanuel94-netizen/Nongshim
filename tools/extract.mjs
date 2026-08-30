/**
 * PHASE 1/5 — content extraction.
 *
 * Turns the cached public HTML into normalised JSON content models under
 * `data/`. Every record keeps source provenance (source URL + fetch date +
 * transformation applied) so the migration is auditable.
 *
 * Nothing here invents data: a field that is not publicly present is omitted.
 */
import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { ORIGIN, get } from './lib/fetcher.mjs';

const EXTRACTED_AT = new Date().toISOString().slice(0, 10);

const clean = (s) => (s ?? '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const oneLine = (s) => clean(s).replace(/\s+/g, ' ');

/**
 * The source emits inline styles with an unterminated `url(` (see finding R-19),
 * so match up to the first quote, paren, or whitespace instead of requiring `)`.
 */
function bgUrl(style) {
  const m = /background-image\s*:\s*url\(\s*(['"]?)([^'")\s]+)/i.exec(style || '');
  return m ? normalizeAsset(m[2]) : null;
}

/** Fix source asset URL defects: protocol-relative, http://, and double slashes. */
function normalizeAsset(raw) {
  if (!raw) return null;
  let u = raw.trim();
  if (u.startsWith('//')) u = 'https:' + u;
  else if (u.startsWith('/')) u = ORIGIN + u;
  u = u.replace(/^http:\/\//i, 'https://');
  // image.nongshim.com//noo/... -> image.nongshim.com/noo/...
  u = u.replace(/(https:\/\/[^/]+)\/{2,}/, '$1/');
  return u;
}

/**
 * Recipe and product titles contain unescaped `<...>` runs that browsers parse
 * as tags and drop (finding R-10). cheerio drops them too, so recover them from
 * the sibling `alt` attribute where one exists.
 */
function splitTitleAnnotation(title) {
  const m = /^(.*?)\s*<([^<>]+)>\s*$/.exec(title || '');
  if (!m) return { name: oneLine(title), annotation: null };
  return { name: oneLine(m[1]), annotation: oneLine(m[2]).replace(/_/g, ' — ') };
}

/** Slugify to a stable, human-readable, URL-safe segment. */
function slugify(s) {
  return oneLine(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * The public catalogue contains distinct entities that share a display name
 * (two different "Champong Noodle Soup" products; two different
 * "Tray Doongji Cold Noodle" recipes). They must not be merged and must not
 * collide, so append a deterministic discriminator drawn from the source data.
 * Records are sorted first so the assignment is stable across runs.
 */
function decollideSlugs(records, discriminator) {
  const counts = new Map();
  for (const r of records) counts.set(r.slug, (counts.get(r.slug) ?? 0) + 1);
  for (const r of records) {
    if (counts.get(r.slug) > 1) {
      r.slugCollision = r.slug;
      r.slug = `${r.slug}-${slugify(String(discriminator(r)))}`;
    }
  }
  return records;
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_BY_TAB = {
  instant: { id: 'instant-noodles', name: 'Instant Noodles' },
  snacks: { id: 'snacks', name: 'Snacks' },
  beverages: { id: 'beverages', name: 'Beverages' },
  simple: { id: 'home-meal-replacement', name: 'Home Meal Replacement' },
};

/** Parse a `/brand/main/detail?prodCode=` or `container` info box into specs. */
function parseInfoBox($, scope) {
  const specs = {};
  scope.find('.introduction').each((_, el) => {
    const label = oneLine($(el).find('.info').text());
    const value = oneLine($(el).find('.result').text());
    if (!label || !value) return;
    specs[label.toLowerCase()] = value;
  });

  // The description is authored in a WYSIWYG and arrives as nested <div>s.
  const descEl = scope.find('.desc').first();
  const paragraphs = [];
  if (descEl.length) {
    const html = descEl.html() || '';
    const $d = cheerio.load(`<div id="r">${html}</div>`);
    $d('#r br').replaceWith('\n');
    $d('#r div, #r p').each((_, el) => {
      const t = clean($d(el).clone().children('div,p').remove().end().text());
      if (t) paragraphs.push(...t.split('\n').map(oneLine).filter(Boolean));
    });
    if (!paragraphs.length) {
      const t = clean($d('#r').text());
      if (t) paragraphs.push(...t.split('\n').map(oneLine).filter(Boolean));
    }
  }
  // De-duplicate: nested divs make the same sentence appear at several depths.
  const seen = new Set();
  const description = paragraphs.filter((p) => {
    if (seen.has(p) || p.length < 2) return false;
    seen.add(p);
    return true;
  });

  return {
    name: oneLine(scope.find('.name').first().text()) || null,
    tagline: clean(scope.find('.kinds').first().html()?.replace(/<br\s*\/?>/gi, ' ') ?? '').replace(/\s+/g, ' ') || null,
    weight: specs.weights ?? null,
    released: specs.releases ?? null,
    certification: specs.certified ?? null,
    otherSpecs: Object.fromEntries(Object.entries(specs).filter(([k]) => !['weights', 'releases', 'certified'].includes(k))),
    description,
  };
}

async function extractProducts(inventory) {
  const cards = inventory.productCards;
  // A product appears once per tab it belongs to; the tab is its category.
  const byBrand = new Map();
  for (const c of cards) {
    if (!byBrand.has(c.brandId)) byBrand.set(c.brandId, { card: c, tabs: new Set() });
    if (c.tab !== 'all') byBrand.get(c.brandId).tabs.add(c.tab);
    // Prefer a card that has an image and a tagline.
    const cur = byBrand.get(c.brandId).card;
    if ((!cur.listImage && c.listImage) || (!cur.tagline && c.tagline)) byBrand.get(c.brandId).card = c;
  }

  const products = [];
  let n = 0;
  for (const [brandId, { card, tabs }] of byBrand) {
    process.stdout.write(`\r   product ${++n}/${byBrand.size} ${brandId}          `);
    const res = await get(`${ORIGIN}/brand/main/container?brandId=${encodeURIComponent(brandId)}&isMobile=N`);
    const $ = cheerio.load(res.body);

    const info = parseInfoBox($, $('.product-detail-info-box').first());

    // Gallery slides = packaging variants, each with its own numeric prodCode.
    const variantRefs = [];
    $('.gallery-top .swiper-slide').each((_, el) => {
      const code = $(el).attr('data-prod-code');
      const image = bgUrl($(el).attr('style'));
      if (code) variantRefs.push({ prodCode: code, image });
    });

    const variants = [];
    for (const ref of variantRefs) {
      const vres = await get(`${ORIGIN}/brand/main/detail?prodCode=${ref.prodCode}`);
      const $v = cheerio.load(`<div id="box" class="product-detail-info-box">${vres.body}</div>`);
      const vinfo = parseInfoBox($v, $v('#box'));
      variants.push({
        prodCode: ref.prodCode,
        name: vinfo.name,
        slug: slugify(vinfo.name || `${brandId}-${ref.prodCode}`),
        image: ref.image,
        weight: vinfo.weight,
        released: vinfo.released,
        certification: vinfo.certification,
        otherSpecs: vinfo.otherSpecs,
        sourceUrl: `${ORIGIN}/brand/main/detail?prodCode=${ref.prodCode}`,
      });
    }

    // Anchor ids must be unique within a product page: two variants can share
    // a display name (Onion Rings has two packs both called "Onion Rings"), so
    // fall back to the source's own product code.
    decollideSlugs(variants, (v) => v.prodCode);

    const categoryTab = [...tabs][0] ?? null;
    const category = categoryTab ? CATEGORY_BY_TAB[categoryTab] : null;
    const name = info.name || card.name;

    products.push({
      id: brandId,
      slug: slugify(name || brandId),
      name: oneLine(name),
      tagline: oneLine(card.tagline || info.tagline || ''),
      category: category?.id ?? 'uncategorised',
      categoryName: category?.name ?? null,
      featured: card.size === 'large',
      listImage: normalizeAsset(card.listImage),
      heroImage: variants[0]?.image ?? normalizeAsset(card.listImage),
      weight: info.weight,
      released: info.released,
      certification: info.certification,
      otherSpecs: info.otherSpecs,
      description: info.description,
      variants,
      provenance: {
        sourceUrls: [
          `${ORIGIN}/brand/main/index`,
          `${ORIGIN}/brand/main/container?brandId=${brandId}`,
          ...variants.map((v) => v.sourceUrl),
        ],
        sourceChecked: EXTRACTED_AT,
        transformation: 'structure-only: AJAX fragments normalised to JSON; asset URLs https-normalised; no copy rewritten',
      },
    });
  }
  console.log('');
  return products.sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* Recipes                                                             */
/* ------------------------------------------------------------------ */

async function extractRecipes(inventory) {
  const recipes = [];
  let n = 0;
  for (const r of inventory.recipes) {
    process.stdout.write(`\r   recipe ${++n}/${inventory.recipes.length}          `);
    const url = `${ORIGIN}/recipe/recipe_view?recipeId=${r.recipeId}`;
    const res = await get(url);
    const $ = cheerio.load(res.body);
    const scope = $('#content-block').first();

    // The `alt` attribute survives the unescaped-angle-bracket bug; the visible
    // heading does not. Prefer whichever retains the annotation.
    const headingText = oneLine(scope.find('.header-heading').first().text());
    const altText = oneLine(r.listAlt || '');
    const rawTitle = altText.length > headingText.length ? altText : headingText || r.title;
    const { name, annotation } = splitTitleAnnotation(rawTitle);
    if (!name) continue;

    const heroes = [];
    scope.find('#recipe-swiper .swiper-slide .item').each((_, el) => {
      const u = bgUrl($(el).attr('style'));
      if (u) heroes.push(u);
    });
    if (!heroes.length && r.listImage) heroes.push(normalizeAsset(r.listImage));

    // <dl> pairs: "Neat explanation" -> summary, "Ingredient" -> ingredients.
    let summary = null;
    let ingredientsRaw = null;
    const dl = scope.find('.recipe-desc').first();
    dl.find('dt').each((_, dt) => {
      const label = oneLine($(dt).text()).toLowerCase();
      const value = clean($(dt).next('dd').text());
      if (!value) return;
      if (label.includes('explanation') || label.includes('summary')) summary = oneLine(value);
      else if (label.includes('ingredient')) ingredientsRaw = value;
    });

    /** Ingredients are a free-text comma/newline list — split, never invent. */
    const ingredients = ingredientsRaw
      ? ingredientsRaw
          .split(/\n|,(?![^(]*\))/)
          .map(oneLine)
          .filter((s) => s.length > 1)
      : [];

    const steps = [];
    scope.find('.cook-list > li').each((_, li) => {
      const $li = $(li);
      const textEl = $li.find('.txt p').first();
      const t = clean(textEl.text());
      const img = bgUrl($li.find('.img').attr('style'));
      if (!t && !img) return;
      steps.push({ text: oneLine(t), image: img });
    });

    recipes.push({
      id: r.recipeId,
      slug: slugify(name),
      name,
      annotation,
      summary,
      heroImage: heroes[0] ?? null,
      gallery: heroes,
      ingredients,
      ingredientsRaw: ingredientsRaw ? oneLine(ingredientsRaw) : null,
      steps,
      provenance: {
        sourceUrls: [url],
        sourceChecked: EXTRACTED_AT,
        transformation:
          'structure-only: dl/ol parsed to JSON; unescaped <> annotation recovered from alt attribute; asset URLs https-normalised; no copy rewritten',
      },
    });
  }
  console.log('');
  return recipes;
}

/* ------------------------------------------------------------------ */
/* Product <-> recipe relationships                                    */
/* ------------------------------------------------------------------ */

/**
 * Link recipes to products by matching product names against the recipe's own
 * ingredient text. Evidence-based only: a relationship is asserted solely when
 * the public recipe names the product. Nothing is inferred or invented.
 */
function linkRecipesToProducts(products, recipes) {
  // Build match terms from product and variant names. Short/ambiguous terms
  // (e.g. "Udon", "Soba") are dropped: they are generic noodle nouns and would
  // produce false positives against ordinary ingredient lists.
  const GENERIC = new Set(['udon', 'soba', 'ramyun', 'noodle', 'noodles', 'kalguksoo', 'pretzel', 'water']);
  const terms = [];
  for (const p of products) {
    const names = new Set([p.name, ...p.variants.map((v) => v.name)].filter(Boolean));
    for (const n of names) {
      const norm = oneLine(n).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (norm.length < 5 || GENERIC.has(norm)) continue;
      terms.push({ term: norm, productId: p.id });
    }
  }
  // Longest first so "Shin Ramyun Black" wins over "Shin Ramyun".
  terms.sort((a, b) => b.term.length - a.term.length);

  const recipesByProduct = new Map(products.map((p) => [p.id, []]));

  for (const r of recipes) {
    const haystack = ` ${oneLine(`${r.ingredientsRaw ?? ''} ${r.name}`).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `;
    const matched = new Set();
    for (const { term, productId } of terms) {
      if (matched.has(productId)) continue;
      if (haystack.includes(` ${term} `)) matched.add(productId);
    }
    r.relatedProducts = [...matched];
    for (const id of matched) recipesByProduct.get(id).push(r.id);
  }

  for (const p of products) p.relatedRecipes = recipesByProduct.get(p.id);

  // Related products: same category, nearest by release date, excluding self.
  for (const p of products) {
    p.relatedProducts = products
      .filter((o) => o.id !== p.id && o.category === p.category)
      .sort((a, b) => String(a.released ?? '').localeCompare(String(b.released ?? '')))
      .slice(0, 4)
      .map((o) => o.id);
  }
}

/* ------------------------------------------------------------------ */
/* Company pages                                                       */
/* ------------------------------------------------------------------ */

/**
 * Capture the public company/sustainability/PR/investor page content as
 * structured blocks. Copy is preserved verbatim; only markup is normalised.
 */
function extractPageContent(page, html) {
  const $ = cheerio.load(html);
  const scope = $('#content-block').first();
  if (!scope.length) return null;

  const isKoreanText = (t) => /[ㄱ-ㆎ가-힣]/.test(t);

  /**
   * Tables are captured as whole tables, not as a flat run of cells: flattening
   * loses column alignment whenever a cell holds only an icon or a link with no
   * text, which is common in the source's document-listing tables.
   */
  const tables = [];
  scope.find('table').each((_, table) => {
    const $t = $(table);
    const head = $t
      .find('thead th, tr:first-child th')
      .map((_, th) => oneLine($(th).text()))
      .get();
    const rows = [];
    $t.find('tbody tr, tr').each((_, tr) => {
      const cells = $(tr).children('td');
      if (!cells.length) return;
      const row = cells
        .map((_, td) => {
          const $td = $(td);
          const t = oneLine($td.text());
          if (t) return t;
          // Preserve alignment: an icon/link-only cell keeps its position, and
          // carries the link target where one exists.
          const href = $td.find('a[href]').attr('href');
          return href ? oneLine($td.find('a').attr('title') || 'Download') : '';
        })
        .get();
      if (row.some(Boolean)) rows.push(row);
    });
    const caption = oneLine($t.find('caption').first().text());
    if (rows.length) {
      tables.push({
        caption: caption && !isKoreanText(caption) ? caption : null,
        head: head.filter((h) => !isKoreanText(h)),
        rows,
      });
    }
  });

  const blocks = [];
  let tableIndex = 0;
  scope.find('h2, h3, h4, p, li, dt, dd, table').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const $el = $(el);
    if (tag === 'table') {
      if (tableIndex < tables.length) blocks.push({ tag: 'table', text: '', table: tableIndex++ });
      return;
    }
    // Skip nodes whose text comes entirely from a nested node we also visit,
    // and any copy that lives inside a table (captured above).
    if ($el.find('h2,h3,h4,p,li,dt,dd').length) return;
    if ($el.closest('table').length) return;
    const t = oneLine($el.text());
    if (!t || t.length < 2) return;
    // Untranslated Korean strings leak onto several English pages; omit them
    // rather than show Korean to English readers (a source-side defect).
    if (isKoreanText(t)) return;
    blocks.push({ tag, text: t });
  });

  const images = [];
  scope.find('img').each((_, el) => {
    const src = normalizeAsset($(el).attr('src'));
    if (src) images.push({ src, alt: $(el).attr('alt') ?? null });
  });
  scope.find('[style*="background-image"]').each((_, el) => {
    const src = bgUrl($(el).attr('style'));
    if (src) images.push({ src, alt: null, background: true });
  });

  return {
    path: new URL(page.url).pathname,
    section: new URL(page.url).pathname.split('/')[1],
    sourceUrl: page.url,
    heading: oneLine(scope.find('h2').first().text()) || null,
    blocks,
    tables,
    images,
    provenance: {
      sourceUrls: [page.url],
      sourceChecked: EXTRACTED_AT,
      transformation: 'structure-only: visible copy preserved verbatim, markup normalised',
    },
  };
}

/* ------------------------------------------------------------------ */
/* SHIN character                                                      */
/* ------------------------------------------------------------------ */

/**
 * The SHIN content lives in a JS-only modal on /brand/main/index with no URL of
 * its own (finding R-12). Extract it so it can become an indexable page.
 * `shin-txt-icon.png` renders the word "SHIN" as an image inside sentences;
 * replacing it with the literal text is a technical fix, not an edit.
 */
function extractCharacter(html) {
  const $ = cheerio.load(html);
  const root = $('#shinramyun-popup');
  if (!root.length) return null;

  const textOf = ($el) => {
    const c = $el.clone();
    c.find('img.txt-shin').replaceWith('SHIN');
    c.find('br').replaceWith('\n');
    return clean(c.text())
      .split('\n')
      .map(oneLine)
      .filter(Boolean)
      .join(' ');
  };

  const profile = [];
  root.find('.profile-table tbody tr').each((_, tr) => {
    const cells = $(tr).children();
    for (let i = 0; i + 1 < cells.length; i += 2) {
      const label = oneLine($(cells[i]).text());
      const value = oneLine($(cells[i + 1]).text());
      if (label && value) profile.push({ label, value });
    }
  });

  const story = root
    .find('.story-section .blinds')
    .map((_, el) => textOf($(el)))
    .get()
    .filter(Boolean);

  const gallery = root
    .find('.gallery-section .swiper-slide img')
    .map((_, el) => normalizeAsset($(el).attr('src')))
    .get()
    .filter(Boolean);

  return {
    id: 'shin',
    name: 'SHIN',
    intro: textOf(root.find('.hero-section .quote')),
    heroImage: normalizeAsset(root.find('.hero-section img.pc').attr('src')),
    storyHeading: oneLine(root.find('.story-section h2').text()),
    storyImage: normalizeAsset(root.find('.comic-panel img.pc').attr('src')),
    story,
    profileHeading: oneLine(root.find('.profile-section h2').text()),
    profileImage: normalizeAsset(root.find('.profile-section .circle-bg img').attr('src')),
    profile,
    galleryHeading: oneLine(root.find('.gallery-section h2').text()),
    gallery,
    provenance: {
      sourceUrls: [`${ORIGIN}/brand/main/index`],
      sourceChecked: EXTRACTED_AT,
      transformation:
        'structure-only: modal content lifted to a document; "SHIN" wordmark images replaced by the literal text they depict; Korean alt text replaced with English equivalents at render time',
    },
  };
}

/* ------------------------------------------------------------------ */

async function main() {
  const inventory = JSON.parse(await fs.readFile('audit/site-inventory.json', 'utf8'));
  await fs.mkdir('data', { recursive: true });

  console.log('-> extracting products');
  const products = decollideSlugs(await extractProducts(inventory), (p) =>
    p.released ? String(p.released).slice(0, 4) : p.id
  );
  // Two distinct products share the display name "Champong Noodle Soup". Their
  // page titles are disambiguated by release year — a published fact — so no
  // two indexable pages carry the same <title>.
  for (const p of products) {
    p.displayTitle = p.slugCollision && p.released ? `${p.name} (${String(p.released).slice(0, 4)})` : p.name;
  }
  console.log(`   ${products.length} products, ${products.reduce((n, p) => n + p.variants.length, 0)} variants`);

  console.log('-> extracting recipes');
  const recipes = decollideSlugs(await extractRecipes(inventory), (r) => r.id);
  // The source publishes two different recipes under the name "Tray Doongji
  // Cold Noodle". Their titles are disambiguated with the opening words of each
  // recipe's own published summary rather than with an invented distinction.
  for (const r of recipes) {
    if (!r.slugCollision || !r.summary) {
      r.displayTitle = r.name;
      continue;
    }
    const words = r.summary.split(/\s+/).slice(0, 4).join(' ').replace(/[,.;:]$/, '');
    r.displayTitle = `${r.name} — ${words}`;
  }
  console.log(`   ${recipes.length} recipes`);

  console.log('-> linking recipes to products');
  linkRecipesToProducts(products, recipes);
  const linked = recipes.filter((r) => r.relatedProducts.length).length;
  console.log(`   ${linked}/${recipes.length} recipes name a catalogue product`);

  await fs.writeFile('data/products.json', JSON.stringify(products, null, 2));
  await fs.writeFile('data/recipes.json', JSON.stringify(recipes, null, 2));

  console.log('-> extracting company / section pages');
  const SECTIONS = new Set(['about', 'sustainability', 'pr', 'investors', 'contact']);
  const pages = [];
  for (const p of inventory.pages) {
    if (p.status !== 200) continue;
    const section = new URL(p.url).pathname.split('/')[1];
    if (!SECTIONS.has(section)) continue;
    if (new URL(p.url).searchParams.size) continue; // paginated list views
    const res = await get(p.url);
    const content = extractPageContent(p, res.body);
    if (content && content.blocks.length) pages.push(content);
  }
  await fs.writeFile('data/pages.json', JSON.stringify(pages, null, 2));
  console.log(`   ${pages.length} section pages`);

  console.log('-> extracting SHIN character');
  const brand = await get(`${ORIGIN}/brand/main/index`);
  const character = extractCharacter(brand.body);
  await fs.writeFile('data/character.json', JSON.stringify(character, null, 2));
  console.log(`   ${character ? `${character.profile.length} profile fields, ${character.story.length} story panels, ${character.gallery.length} gallery images` : 'NOT FOUND'}`);
}

main();
