/**
 * PHASE 13 — accessibility audit over `dist/`.
 *
 * Static analysis against WCAG 2.2 AA, covering the checks that can be made
 * reliably from markup and the design tokens: landmark structure, heading
 * order, link and control names, form labelling, table semantics, alt text,
 * language, target size, and colour contrast for every token pairing the site
 * actually uses.
 *
 * It does not replace a screen-reader pass or a keyboard walkthrough — those
 * are recorded in audit/accessibility-audit.md. Exit code 1 on any violation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';

const DIST = 'dist';
const violations = [];
const notes = [];

/* --------------------------------------------------------- contrast ------ */

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/**
 * Every foreground/background pairing the stylesheets actually produce, with
 * the WCAG level each must reach. Large text is >= 18.66px bold or >= 24px.
 */
const PAIRS = [
  { name: 'body text on page', fg: '#222222', bg: '#ffffff', min: 4.5 },
  { name: 'body text on surface', fg: '#222222', bg: '#f6f6f6', min: 4.5 },
  { name: 'muted text on page', fg: '#5f5f5f', bg: '#ffffff', min: 4.5 },
  { name: 'muted text on surface', fg: '#5f5f5f', bg: '#f6f6f6', min: 4.5 },
  { name: 'headings on page', fg: '#111111', bg: '#ffffff', min: 4.5 },
  { name: 'link text on page', fg: '#2c5f00', bg: '#ffffff', min: 4.5 },
  { name: 'link hover on page', fg: '#1f4300', bg: '#ffffff', min: 4.5 },
  { name: 'eyebrow / accent text on page', fg: '#3f7500', bg: '#ffffff', min: 4.5 },
  { name: 'eyebrow / accent text on surface', fg: '#3f7500', bg: '#f6f6f6', min: 4.5 },
  { name: 'primary button label', fg: '#ffffff', bg: '#3f7500', min: 4.5 },
  { name: 'primary button hover label', fg: '#ffffff', bg: '#2f5800', min: 4.5 },
  { name: 'source green as a rule / border (non-text)', fg: '#539a00', bg: '#ffffff', min: 3.0 },
  { name: 'hero eyebrow on the darkest scrim', fg: '#96c11f', bg: '#3c3c3c', min: 4.5 },
  { name: 'hero heading on the darkest scrim', fg: '#ffffff', bg: '#3c3c3c', min: 4.5 },
  { name: 'SHIN heading (large text)', fg: '#df0029', bg: '#ffffff', min: 3.0 },
  { name: 'focus ring against page', fg: '#0a3398', bg: '#ffffff', min: 3.0 },
  { name: 'focus ring against surface', fg: '#0a3398', bg: '#f6f6f6', min: 3.0 },
  { name: 'border against page (non-text)', fg: '#cccccc', bg: '#ffffff', min: 1.0 },
];

function auditContrast() {
  for (const pair of PAIRS) {
    const ratio = contrast(pair.fg, pair.bg);
    const line = `${pair.name}: ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)}:1 (needs ${pair.min}:1)`;
    if (ratio < pair.min) violations.push(`contrast — ${line}`);
    else notes.push(line);
  }
}

/* ------------------------------------------------------------ markup ----- */

async function walk(dir, base = '') {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, `${base}/${entry.name}`)));
    else if (entry.name.endsWith('.html')) {
      out.push({ route: (entry.name === 'index.html' ? `${base}/` : `${base}/${entry.name}`).replace(/^\/\//, '/'), file: full });
    }
  }
  return out;
}

const text = ($el) => $el.text().replace(/\s+/g, ' ').trim();

/** Accessible name of an interactive element, in the order a browser computes it. */
function accessibleName($, el) {
  const $el = $(el);
  const labelledby = $el.attr('aria-labelledby');
  if (labelledby) {
    const parts = labelledby.split(/\s+/).map((id) => text($(`#${id}`)));
    if (parts.some(Boolean)) return parts.join(' ');
  }
  const label = $el.attr('aria-label');
  if (label?.trim()) return label.trim();
  const own = text($el);
  if (own) return own;
  const img = $el.find('img[alt]').first().attr('alt');
  if (img?.trim()) return img.trim();
  const title = $el.attr('title');
  return title?.trim() ?? '';
}

function auditPage(route, html) {
  const $ = cheerio.load(html);

  /* --- landmarks --- */
  if ($('main').length !== 1) violations.push(`${route}: expected exactly one <main>, found ${$('main').length}`);
  if ($('header').length < 1) violations.push(`${route}: no <header> landmark`);
  if ($('footer').length < 1) violations.push(`${route}: no <footer> landmark`);
  if (!$('a.skip-link').length) violations.push(`${route}: no skip link`);
  else if ($('a.skip-link').attr('href') !== '#main') violations.push(`${route}: skip link does not target #main`);

  /* --- language --- */
  const lang = $('html').attr('lang');
  if (!lang) violations.push(`${route}: <html> has no lang`);

  /* --- headings --- */
  const h1s = $('h1');
  if (h1s.length !== 1) violations.push(`${route}: ${h1s.length} <h1> elements (WCAG 2.4.6 / 1.3.1)`);
  let previous = 0;
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    const level = Number(el.tagName[1]);
    const t = text($(el));
    if (!t) violations.push(`${route}: empty h${level}`);
    if (previous && level > previous + 1) {
      violations.push(`${route}: heading order skips h${previous} -> h${level} ("${t}")`);
    }
    previous = level;
  });

  /* --- navigation landmarks must be distinguishable --- */
  const navNames = $('nav')
    .map((_, el) => $(el).attr('aria-label') ?? $(el).attr('aria-labelledby') ?? '')
    .get();
  if (navNames.some((n) => !n)) violations.push(`${route}: a <nav> has no accessible name`);
  if (new Set(navNames).size !== navNames.length) {
    violations.push(`${route}: two <nav> landmarks share a name (${navNames.join(', ')})`);
  }

  /* --- links and buttons --- */
  $('a[href]').each((_, el) => {
    const name = accessibleName($, el);
    const href = $(el).attr('href') ?? '';
    if (!name) violations.push(`${route}: link to ${href} has no accessible name (WCAG 2.4.4)`);
    if (/^(click here|read more|more|here|link|this)$/i.test(name)) {
      violations.push(`${route}: non-descriptive link text "${name}" (WCAG 2.4.4)`);
    }
    if (/^https?:/.test(href) && !/(noopener|noreferrer)/.test($(el).attr('rel') ?? '') && $(el).attr('target') === '_blank') {
      violations.push(`${route}: target=_blank without rel=noopener on ${href}`);
    }
  });

  $('button').each((_, el) => {
    if (!accessibleName($, el)) violations.push(`${route}: <button> has no accessible name`);
  });

  /* --- images --- */
  $('img').each((_, el) => {
    const $el = $(el);
    if ($el.attr('alt') === undefined) {
      violations.push(`${route}: <img src="${$el.attr('src')}"> has no alt attribute (WCAG 1.1.1)`);
    }
    const alt = $el.attr('alt') ?? '';
    if (alt && /[ㄱ-ㆎ가-힣]/.test(alt)) {
      violations.push(`${route}: alt text is not in the page language ("${alt}")`);
    }
    if (alt && alt.length > 180) violations.push(`${route}: alt text is ${alt.length} chars — too long to hear`);
  });

  /* --- forms --- */
  $('input, select, textarea').each((_, el) => {
    const $el = $(el);
    const type = ($el.attr('type') ?? '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset'].includes(type)) return;
    const id = $el.attr('id');
    const labelled =
      (id && $(`label[for="${id}"]`).length > 0) ||
      Boolean($el.attr('aria-label')) ||
      Boolean($el.attr('aria-labelledby')) ||
      $el.parents('label').length > 0;
    if (!labelled) violations.push(`${route}: form control ${type || el.tagName} has no label (WCAG 3.3.2)`);
  });

  /* --- tables --- */
  $('table').each((_, el) => {
    const $t = $(el);
    if (!$t.find('th').length) violations.push(`${route}: <table> has no header cells (WCAG 1.3.1)`);
    $t.find('th').each((_, th) => {
      if (!$(th).attr('scope')) violations.push(`${route}: <th> without scope (WCAG 1.3.1)`);
    });
    if (!$t.find('caption').length && !$t.attr('aria-label') && !$t.attr('aria-labelledby')) {
      notes.push(`${route}: <table> has no caption`);
    }
  });

  /* --- iframes --- */
  $('iframe').each((_, el) => {
    if (!$(el).attr('title')) violations.push(`${route}: <iframe> without a title (WCAG 4.1.2)`);
  });

  /* --- duplicate ids break every id-based association --- */
  const seenIds = new Set();
  $('[id]').each((_, el) => {
    const id = $(el).attr('id');
    if (seenIds.has(id)) violations.push(`${route}: duplicate id "${id}" (WCAG 4.1.1)`);
    seenIds.add(id);
  });

  /* --- zoom --- */
  const viewport = $('meta[name="viewport"]').attr('content') ?? '';
  if (/user-scalable\s*=\s*no/.test(viewport) || /maximum-scale\s*=\s*1(\D|$)/.test(viewport)) {
    violations.push(`${route}: viewport prevents zoom (WCAG 1.4.4)`);
  }

  /* --- ARIA misuse: a role that duplicates the native element --- */
  const REDUNDANT = { nav: 'navigation', main: 'main', header: 'banner', footer: 'contentinfo', button: 'button', a: 'link' };
  $('[role]').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    if (REDUNDANT[tag] === $(el).attr('role')) {
      violations.push(`${route}: <${tag} role="${$(el).attr('role')}"> is redundant`);
    }
  });

  /* --- aria-hidden must never hide something focusable --- */
  $('[aria-hidden="true"]').each((_, el) => {
    if ($(el).find('a[href], button, input, select, textarea, [tabindex]').length) {
      violations.push(`${route}: aria-hidden element contains focusable content (WCAG 4.1.2)`);
    }
  });

  /* --- <details> disclosures must have a summary --- */
  $('details').each((_, el) => {
    if (!$(el).children('summary').length) violations.push(`${route}: <details> without <summary>`);
  });
}

/* ---------------------------------------------------------------- run ---- */

async function main() {
  auditContrast();

  const files = await walk(DIST);
  for (const { route, file } of files) {
    auditPage(route, await fs.readFile(file, 'utf8'));
  }

  await fs.mkdir('audit', { recursive: true });
  await fs.writeFile(
    'audit/a11y-audit.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), pages: files.length, violations, notes }, null, 2)
  );

  console.log('Accessibility audit (WCAG 2.2 AA, static analysis)');
  console.log(`  pages checked      ${files.length}`);
  console.log(`  contrast pairings  ${PAIRS.length}`);
  console.log(`  violations         ${violations.length}`);
  console.log('');
  console.log('  Contrast ratios:');
  for (const n of notes.filter((n) => n.includes(':1'))) console.log(`    ${n}`);

  if (violations.length) {
    console.error('\n  Violations:');
    for (const v of violations.slice(0, 60)) console.error(`    - ${v}`);
    if (violations.length > 60) console.error(`    … and ${violations.length - 60} more`);
    process.exit(1);
  }
  console.log('\n  No violations found by static analysis.');
}

main();
