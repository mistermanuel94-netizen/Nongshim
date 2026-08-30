/**
 * PHASE 1 — asset inventory and acquisition.
 *
 * Collects every content asset referenced by the extracted content models,
 * downloads it into `src/assets/` so Astro can optimise it at build time
 * (AVIF/WebP + srcset), and records dimensions, bytes and usage in
 * audit/asset-audit.csv + audit/image-audit.csv.
 *
 * Assets are Nongshim's own published imagery on Nongshim's own origins; they
 * are re-hosted unmodified so the rebuild preserves the real product and recipe
 * photography rather than substituting placeholders.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT_DIR = 'src/assets/source';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Read PNG/JPEG/GIF/WebP intrinsic dimensions from the file header. */
function probeDimensions(buf) {
  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: 'png' };
  }
  // GIF
  if (buf.length > 10 && buf.subarray(0, 3).toString('latin1') === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8), format: 'gif' };
  }
  // WebP (VP8X / VP8 / VP8L)
  if (buf.length > 30 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    const chunk = buf.subarray(12, 16).toString('latin1');
    if (chunk === 'VP8X') return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1, format: 'webp' };
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, format: 'webp' };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, format: 'webp' };
    }
  }
  // JPEG — walk the segment chain to the first SOFn marker.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), format: 'jpeg' };
      }
      i += 2 + len;
    }
    return { width: null, height: null, format: 'jpeg' };
  }
  if (buf.subarray(0, 5).toString('latin1').includes('<svg') || buf.subarray(0, 300).toString('latin1').includes('<svg')) {
    return { width: null, height: null, format: 'svg' };
  }
  return { width: null, height: null, format: 'unknown' };
}

const EXT_BY_FORMAT = { png: '.png', jpeg: '.jpg', gif: '.gif', webp: '.webp', svg: '.svg' };

/** Stable, collision-free local filename derived from the source URL. */
function localName(url, format) {
  const base = path
    .basename(new URL(url).pathname)
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'asset';
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 8);
  const ext = EXT_BY_FORMAT[format] ?? (path.extname(new URL(url).pathname) || '.bin');
  return `${base}-${hash}${ext}`;
}

/** Walk the content models and record every asset URL with its usage context. */
function collectUsages() {
  const usages = new Map();
  const add = (url, use) => {
    if (!url || !/^https?:/i.test(url)) return;
    if (!usages.has(url)) usages.set(url, []);
    usages.get(url).push(use);
  };
  return { usages, add };
}

async function main() {
  const read = async (f) => JSON.parse(await fs.readFile(f, 'utf8'));
  const [products, recipes, character, history, global, offices, headers] = await Promise.all([
    read('data/products.json'),
    read('data/recipes.json'),
    read('data/character.json'),
    read('data/history.json'),
    read('data/global-network.json'),
    read('data/offices.json'),
    read('data/page-headers.json'),
  ]);

  const { usages, add } = collectUsages();

  for (const p of products) {
    add(p.listImage, { type: 'product-card', entity: p.slug, role: 'card', aboveFold: p.featured });
    add(p.heroImage, { type: 'product-hero', entity: p.slug, role: 'hero', aboveFold: true });
    for (const v of p.variants) add(v.image, { type: 'product-variant', entity: `${p.slug}/${v.slug}`, role: 'gallery', aboveFold: false });
  }
  for (const r of recipes) {
    add(r.heroImage, { type: 'recipe-hero', entity: r.slug, role: 'hero', aboveFold: true });
    for (const g of r.gallery) add(g, { type: 'recipe-gallery', entity: r.slug, role: 'gallery', aboveFold: false });
    r.steps.forEach((s, i) => add(s.image, { type: 'recipe-step', entity: `${r.slug}#step-${i + 1}`, role: 'step', aboveFold: false }));
  }
  if (character) {
    add(character.heroImage, { type: 'character', entity: 'shin', role: 'hero', aboveFold: true });
    add(character.storyImage, { type: 'character', entity: 'shin', role: 'story', aboveFold: false });
    add(character.profileImage, { type: 'character', entity: 'shin', role: 'profile', aboveFold: false });
    character.gallery.forEach((g, i) => add(g, { type: 'character-gallery', entity: `shin#pose-${i + 1}`, role: 'gallery', aboveFold: false }));
  }
  for (const e of history.eras.flatMap((x) => x.entries)) {
    add(e.image, { type: 'history', entity: `${e.year}-${e.month ?? ''}`, role: 'thumb', aboveFold: false });
  }
  for (const s of global.subsidiaries) for (const img of s.images) add(img, { type: 'global-network', entity: s.name, role: 'gallery', aboveFold: false });
  for (const o of offices.offices) add(o.image, { type: 'office', entity: o.name, role: 'card', aboveFold: false });
  for (const [p, h] of Object.entries(headers)) add(h.heroImage, { type: 'page-hero', entity: p, role: 'hero', aboveFold: true });

  console.log(`-> ${usages.size} unique asset URLs referenced`);
  await fs.mkdir(OUT_DIR, { recursive: true });

  const urls = [...usages.keys()];
  const records = new Array(urls.length);
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    while (cursor < urls.length) {
      const i = cursor++;
      const url = urls[i];
      const use = usages.get(url);
      let rec = { url, status: 0, bytes: 0, width: null, height: null, format: null, file: null, error: null };
      try {
        const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) });
        rec.status = res.status;
        rec.contentType = res.headers.get('content-type') ?? null;
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const dim = probeDimensions(buf);
          rec = { ...rec, ...dim, bytes: buf.length };
          rec.file = localName(url, dim.format);
          const dest = path.join(OUT_DIR, rec.file);
          // Skip the write when the file already matches (idempotent re-runs).
          let existing = null;
          try {
            existing = await fs.stat(dest);
          } catch {}
          if (!existing || existing.size !== buf.length) await fs.writeFile(dest, buf);
        }
      } catch (err) {
        rec.error = String(err);
      }
      rec.usages = use;
      records[i] = rec;
      process.stdout.write(`\r   ${++done}/${urls.length} fetched   `);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log('');

  const ok = records.filter((r) => r.status === 200);
  const failed = records.filter((r) => r.status !== 200);
  const totalBytes = ok.reduce((n, r) => n + r.bytes, 0);

  // Duplicate detection by exact byte length + dimensions.
  const sig = new Map();
  for (const r of ok) {
    const key = `${r.bytes}x${r.width}x${r.height}`;
    if (!sig.has(key)) sig.set(key, []);
    sig.get(key).push(r.url);
  }
  const duplicates = [...sig.values()].filter((v) => v.length > 1);

  await fs.mkdir('audit', { recursive: true });
  await fs.writeFile('data/assets.json', JSON.stringify(records, null, 2));

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = records.flatMap((r) =>
    r.usages.map((u) =>
      [r.url, r.status, r.format, r.width, r.height, r.bytes, r.file, u.type, u.entity, u.role, u.aboveFold, r.error]
        .map(esc)
        .join(',')
    )
  );
  await fs.writeFile(
    'audit/asset-audit.csv',
    ['sourceUrl,status,format,width,height,bytes,localFile,usageType,entity,role,aboveFold,error', ...rows].join('\n')
  );

  console.log(`   ${ok.length} downloaded, ${failed.length} failed`);
  console.log(`   ${(totalBytes / 1e6).toFixed(1)} MB of source imagery`);
  console.log(`   ${duplicates.length} duplicate asset groups`);
  if (failed.length) console.log('   failures:\n' + failed.slice(0, 20).map((r) => `     ${r.status} ${r.url}`).join('\n'));
}

main();
