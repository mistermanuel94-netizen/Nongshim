/**
 * Content build step — turns the raw extraction in `data/` into the shape the
 * site consumes in `src/content/`.
 *
 * Responsibilities:
 *  - resolve every remote asset URL to a local file under `src/assets/source/`
 *  - drop assets the source could not serve (404, 403, or HTTP 200 with zero
 *    bytes) and fall back to the next available image, so no broken <img> is
 *    ever rendered
 *  - write descriptive, non-repetitive alt text derived from the entity name
 *  - assign categories, canonical paths and cross-entity relationships
 *
 * This runs before `astro build`. It never invents content: an image that does
 * not exist is omitted, not replaced.
 */
import fs from 'node:fs/promises';

const read = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
const write = async (f, v) => fs.writeFile(f, JSON.stringify(v, null, 2));

const CATEGORIES = [
  {
    id: 'instant-noodles',
    name: 'Instant Noodles',
    path: '/products/instant-noodles/',
    description:
      'Nongshim instant noodles, including Shin Ramyun, Chapaghetti, Neoguri and Ansung Noodle Soup, in packet, cup and bowl formats.',
  },
  {
    id: 'snacks',
    name: 'Snacks',
    path: '/products/snacks/',
    description:
      'Nongshim snacks, including Shrimp Crackers, Banana Kick, Onion Rings and Honey Twist, in baked and fried varieties.',
  },
  {
    id: 'beverages',
    name: 'Beverages',
    path: '/products/beverages/',
    description: 'Nongshim beverages, including Baeksan Artesian Water, Capri-Sun and Welch’s.',
  },
  {
    id: 'home-meal-replacement',
    name: 'Home Meal Replacement',
    path: '/products/home-meal-replacement/',
    description: 'Nongshim home meal replacement products from the Cooktam range.',
  },
];

async function main() {
  const [products, recipes, character, history, network, offices, videos, pages, headers, assets] = await Promise.all([
    read('data/products.json'),
    read('data/recipes.json'),
    read('data/character.json'),
    read('data/history.json'),
    read('data/global-network.json'),
    read('data/offices.json'),
    read('data/videos.json'),
    read('data/pages.json'),
    read('data/page-headers.json'),
    read('data/assets.json'),
  ]);

  /**
   * An asset is usable only when the source served real bytes. Thirty-five
   * recipe step images return HTTP 200 with a zero-byte body, and two product
   * card images 404/403 — all source-side defects.
   */
  const usable = new Map();
  const unusable = [];
  for (const a of assets) {
    if (a.status === 200 && a.bytes > 0 && a.file) {
      usable.set(a.url, { file: a.file, width: a.width, height: a.height, bytes: a.bytes, format: a.format });
    } else {
      unusable.push({ url: a.url, status: a.status, bytes: a.bytes, usages: a.usages });
    }
  }

  /** Resolve a source URL to a local image record, or null if unavailable. */
  const img = (url, alt) => {
    const a = url && usable.get(url);
    if (!a) return null;
    return { file: a.file, width: a.width, height: a.height, alt, sourceUrl: url };
  };

  /** First usable image from a preference-ordered list. */
  const firstImg = (urls, alt) => {
    for (const u of urls) {
      const r = img(u, alt);
      if (r) return r;
    }
    return null;
  };

  const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));

  /* ---------------- products ---------------- */
  const outProducts = products.map((p) => {
    const cat = categoryById.get(p.category) ?? null;
    return {
      id: p.id,
      slug: p.slug,
      path: `/products/${p.slug}/`,
      name: p.name,
      displayTitle: p.displayTitle ?? p.name,
      tagline: p.tagline || null,
      category: p.category,
      categoryName: cat?.name ?? null,
      categoryPath: cat?.path ?? null,
      featured: p.featured,
      // Card falls back to the packshot when the source card image is broken.
      cardImage: firstImg([p.listImage, p.heroImage, ...p.variants.map((v) => v.image)], `${p.name} packaging`),
      heroImage: firstImg([p.heroImage, p.listImage, ...p.variants.map((v) => v.image)], `${p.name} pack`),
      weight: p.weight,
      released: p.released,
      certification: p.certification,
      otherSpecs: p.otherSpecs,
      description: p.description,
      variants: p.variants
        .map((v) => ({
          prodCode: v.prodCode,
          slug: v.slug,
          name: v.name,
          image: img(v.image, `${v.name} pack`),
          weight: v.weight,
          released: v.released,
          certification: v.certification,
        }))
        .filter((v) => v.name),
      relatedProducts: p.relatedProducts,
      relatedRecipes: p.relatedRecipes,
      provenance: p.provenance,
    };
  });

  /* ---------------- recipes ---------------- */
  const productBySourceId = new Map(products.map((p) => [p.id, p]));
  const outRecipes = recipes.map((r) => {
    /**
     * Step photos illustrate text that sits immediately beside them, so their
     * alt is the step's opening clause rather than the whole instruction —
     * a long alt is exhausting to hear and duplicates the adjacent copy.
     */
    const stepAlt = (n, text) => {
      const clause = text.split(/(?<=\.)\s|,\s|\.\s/)[0].replace(/[.,]$/, '');
      const short = clause.length > 90 ? `${clause.slice(0, 87).replace(/\s+\S*$/, '')}…` : clause;
      return `Step ${n}: ${short}`;
    };

    const steps = r.steps.map((s, i) => ({
      number: i + 1,
      text: s.text,
      image: img(s.image, stepAlt(i + 1, s.text)),
    }));
    return {
      id: r.id,
      slug: r.slug,
      path: `/recipes/${r.slug}/`,
      name: r.name,
      displayTitle: r.displayTitle ?? r.name,
      annotation: r.annotation,
      summary: r.summary,
      // Eleven recipes' hero photos are zero-byte on the source CDN. Fall back
      // to the recipe's own step photography rather than shipping a gap.
      heroImage:
        firstImg(r.gallery, `${r.name}, plated and ready to serve`) ??
        firstImg(
          r.steps.map((s) => s.image),
          `${r.name} being prepared`
        ),
      ingredients: r.ingredients,
      ingredientsRaw: r.ingredientsRaw,
      steps,
      relatedProducts: r.relatedProducts
        .map((id) => productBySourceId.get(id))
        .filter(Boolean)
        .map((p) => ({ id: p.id, slug: p.slug, name: p.name })),
      provenance: r.provenance,
    };
  });

  // Back-fill each product's recipe list with resolved slugs.
  const recipeBySourceId = new Map(recipes.map((r) => [r.id, r]));
  for (const p of outProducts) {
    p.relatedRecipes = p.relatedRecipes
      .map((id) => recipeBySourceId.get(id))
      .filter(Boolean)
      .map((r) => ({ id: r.id, slug: r.slug, name: r.name }));
    p.relatedProducts = p.relatedProducts
      .map((id) => outProducts.find((o) => o.id === id))
      .filter(Boolean)
      .map((o) => ({ id: o.id, slug: o.slug, name: o.name }));
  }

  /* ---------------- character ---------------- */
  const POSE_ALT = (i) => `SHIN character illustration, pose ${i}`;
  const outCharacter = {
    ...character,
    path: '/shin/',
    heroImage: img(character.heroImage, 'SHIN, the Shin Ramyun character, waving'),
    storyImage: img(character.storyImage, 'Illustrated panels telling the story of how SHIN began travelling the world'),
    profileImage: img(character.profileImage, 'SHIN playing football'),
    gallery: character.gallery.map((g, i) => img(g, POSE_ALT(i + 1))).filter(Boolean),
  };

  /* ---------------- history ---------------- */
  const outHistory = {
    ...history,
    heroImage: img(history.heroImage, 'Nongshim corporate history'),
    entries: history.eras
      .flatMap((e) => e.entries)
      .map((e) => ({ ...e, image: img(e.image, e.caption) })),
  };
  delete outHistory.eras;
  // Group by year, newest first, for the timeline template.
  const byYear = new Map();
  for (const e of outHistory.entries) {
    if (!byYear.has(e.year)) byYear.set(e.year, []);
    byYear.get(e.year).push(e);
  }
  outHistory.years = [...byYear.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, entries]) => ({
      year,
      entries: entries.sort((a, b) => Number(b.month ?? 0) - Number(a.month ?? 0)),
    }));
  delete outHistory.entries;

  /* ---------------- global network ---------------- */
  const officeByName = new Map(offices.offices.map((o) => [o.name.toLowerCase(), o]));
  const outNetwork = {
    ...network,
    heroImage: img(network.heroImage, 'Nongshim global network'),
    subsidiaries: network.subsidiaries.map((s, i) => ({
      ...s,
      slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      images: s.images.map((u) => img(u, `${s.name} facility`)).filter(Boolean),
      contact: network.contacts[i] ?? null,
      links: s.links.filter((l) => l.label),
    })),
  };
  delete outNetwork.contacts;

  const outOffices = {
    ...offices,
    heroImage: img(offices.heroImage, 'Nongshim office locations'),
    offices: offices.offices.map((o) => ({
      ...o,
      image: img(o.image, `${o.name} building`),
      // The source embeds a Google Maps iframe per office. Kept as data so the
      // page can render it behind a click rather than on load.
      mapEmbed: o.mapEmbed,
    })),
  };

  /* ---------------- videos ---------------- */
  const outVideos = { ...videos, heroImage: img(videos.heroImage, 'Nongshim video library') };

  /* ---------------- section pages ---------------- */
  /**
   * Corrections to unambiguous source typos. Only applied where the source
   * itself supplies the correct form elsewhere on the same page, so this is a
   * technical fix rather than an editorial rewrite. Every entry is listed in
   * docs/source-provenance.md.
   */
  const TYPO_FIXES = [{ from: 'Noghshim Flour Mills', to: 'Nongshim Flour Mills' }];
  const fixTypos = (s) => TYPO_FIXES.reduce((acc, f) => acc.split(f.from).join(f.to), s ?? '');

  /**
   * Several source pages share one jumbotron description (the generic "A
   * powerful takeoff..." brand line). A description reused across pages is not
   * a description of any of them, so it is dropped and each page falls back to
   * its own opening paragraph.
   */
  const headerDescCounts = new Map();
  for (const h of Object.values(headers)) {
    if (h.description) headerDescCounts.set(h.description, (headerDescCounts.get(h.description) ?? 0) + 1);
  }

  const outPages = pages.map((p) => {
    const h = headers[p.path] ?? {};
    const uniqueDescription = h.description && headerDescCounts.get(h.description) === 1 ? h.description : null;
    return {
      ...p,
      heading: fixTypos(h.heading ?? p.heading),
      description: uniqueDescription ? fixTypos(uniqueDescription) : null,
      /** Kept for the hero, which may legitimately repeat brand copy. */
      heroDescription: h.description ? fixTypos(h.description) : null,
      blocks: p.blocks.map((b) => ({ ...b, text: fixTypos(b.text) })),
      tables: (p.tables ?? []).map((t) => ({
        caption: t.caption ? fixTypos(t.caption) : null,
        head: t.head.map(fixTypos),
        rows: t.rows.map((row) => row.map(fixTypos)),
      })),
      heroImage: img(h.heroImage, h.heading ? `${h.heading} — Nongshim` : 'Nongshim'),
      images: p.images.map((i) => img(i.src, i.alt || '')).filter(Boolean),
    };
  });

  await fs.mkdir('src/content', { recursive: true });
  await write('src/content/products.json', outProducts);
  await write('src/content/recipes.json', outRecipes);
  await write('src/content/categories.json', CATEGORIES);
  await write('src/content/character.json', outCharacter);
  await write('src/content/history.json', outHistory);
  await write('src/content/network.json', outNetwork);
  await write('src/content/offices.json', outOffices);
  await write('src/content/videos.json', outVideos);
  await write('src/content/pages.json', outPages);

  // Report what the source could not serve, so it is visible rather than silent.
  await write('audit/unavailable-assets.json', unusable);

  const missingStep = outRecipes.reduce((n, r) => n + r.steps.filter((s) => !s.image).length, 0);
  console.log(`   products    ${outProducts.length} (${outProducts.filter((p) => !p.cardImage).length} without a card image)`);
  console.log(`   recipes     ${outRecipes.length} (${outRecipes.filter((r) => !r.heroImage).length} without a hero, ${missingStep} steps without a photo)`);
  console.log(`   character   ${outCharacter.gallery.length} poses`);
  console.log(`   history     ${outHistory.years.length} years`);
  console.log(`   network     ${outNetwork.subsidiaries.length} subsidiaries`);
  console.log(`   offices     ${outOffices.offices.length}`);
  console.log(`   videos      ${outVideos.videos.length}`);
  console.log(`   pages       ${outPages.length}`);
  console.log(`   unusable source assets: ${unusable.length}`);
}

main();
