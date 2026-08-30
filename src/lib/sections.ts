/**
 * Section page routing and metadata.
 *
 * Maps each extracted source page to its new path, breadcrumb trail, and — most
 * importantly — a specific title and description. The source shipped
 * `<title>GLOBAL NONGSHIM</title>` on every page and a description on two, so
 * both are composed here from the page's own heading and lead paragraph.
 * Nothing is invented: the description falls back to the page's first sentence.
 */
import { sectionPages, type SectionPage } from './content';
import type { Crumb } from './seo';
import { BESPOKE_SECTION_PATHS, REMOVED_SECTION_PATHS, newSectionPath } from '../config/routes.mjs';
import { composeDescription, sentence } from './text';

/** Pages that get a bespoke template rather than the generic section renderer. */
export const BESPOKE_PATHS = new Set(BESPOKE_SECTION_PATHS);

/** Source paths that produce no page; never linked from anywhere. */
const REMOVED_PATHS = new Set(REMOVED_SECTION_PATHS);

/** Every source path that becomes a real, linkable page. */
export const isLinkable = (page: SectionPage) => Boolean(page.heading) && !REMOVED_PATHS.has(page.path);

const SECTION_LABEL: Record<string, { name: string; path: string }> = {
  about: { name: 'About', path: '/about/overview/' },
  sustainability: { name: 'Sustainability', path: '/sustainability/overview/' },
  pr: { name: 'Press', path: '/press/' },
  investors: { name: 'Investors', path: '/investors/overview/' },
  contact: { name: 'Contact', path: '/contact/overview/' },
};

/** Section landing pages, which sit directly under home in the breadcrumb. */
const LANDING = new Set(['/about/overview/', '/sustainability/overview/', '/press/', '/investors/overview/', '/contact/overview/']);

export const newPath = newSectionPath;

/**
 * Paragraphs the source repeats verbatim across several pages (the generic
 * brand line, section boilerplate). Text shared between pages describes none of
 * them, so it is never used as a meta description.
 */
const paragraphCounts = new Map<string, number>();
for (const p of sectionPages) {
  for (const b of p.blocks) {
    if (b.tag === 'p') paragraphCounts.set(b.text, (paragraphCounts.get(b.text) ?? 0) + 1);
  }
}

/**
 * A specific meta description for a page.
 * Order of preference: the source's own hero description when it is unique to
 * this page; else the first substantial paragraph that no other page repeats,
 * trimmed to a sentence boundary near 155 characters.
 */
/**
 * A factual one-line summary of a page's data table: how many rows it lists and
 * the range of dates it covers. Several source pages are document indexes whose
 * substance is the table, and this states that substance in prose.
 */
export function tableSummary(page: SectionPage): string | null {
  const table = page.tables?.find((t) => t.rows.length > 1);
  if (!table) return null;
  const years = page.tables
    .flatMap((t) => t.rows.flat())
    .flatMap((cell) => [...cell.matchAll(/(19|20)\d{2}/g)].map((m) => m[0]))
    .sort();
  const rows = page.tables.reduce((n, t) => n + t.rows.length, 0);
  const noun = page.heading ? page.heading.toLowerCase().replace(/s$/, '') : 'document';
  const span = years.length > 1 && years[0] !== years[years.length - 1] ? ` covering ${years[0]} to ${years[years.length - 1]}` : '';
  return `${rows} ${noun}${rows === 1 ? '' : 's'}${span}.`;
}

export function describe(page: SectionPage, { withChildren = false } = {}): string {
  /**
   * A landing page's own copy is often a single short line. Naming the pages it
   * leads to makes the description specific without inventing anything — the
   * names are the child pages' own published headings.
   */
  const childSentence = () => {
    if (!withChildren) return null;
    const names = sectionPages
      .filter((p) => p.section === page.section && newSectionPath(p.path) !== newSectionPath(page.path) && isLinkable(p))
      .map((p) => p.heading as string);
    if (names.length < 2) return null;
    return `Covers ${names.slice(0, 4).join(', ')}${names.length > 4 ? ' and more' : ''}.`;
  };

  if (page.description) {
    return composeDescription([sentence(page.description), tableSummary(page), childSentence()]);
  }
  const para = page.blocks.find(
    (b) => b.tag === 'p' && b.text.length > 60 && (paragraphCounts.get(b.text) ?? 0) === 1
  );
  if (!para) {
    const heading = page.heading ?? 'Nongshim';
    const own = page.blocks.find((b) => b.tag === 'p' && b.text.length > 30);
    return composeDescription([
      `${heading} — Nongshim.`,
      own ? sentence(own.text) : null,
      tableSummary(page),
      childSentence(),
      own ? null : `Information published by Nongshim Co., Ltd. in the ${SECTION_LABEL[page.section]?.name ?? 'company'} section.`,
    ]);
  }
  return composeDescription([sentence(para.text), tableSummary(page), childSentence()]);
}

/**
 * Section headings are not unique across the site: "Youlchon Foundation" is
 * both a group affiliate and a sustainability page. Where a heading is shared,
 * the title is qualified with its section so no two pages carry one title.
 */
const headingCounts = new Map<string, number>();
for (const p of sectionPages) {
  if (p.heading) headingCounts.set(p.heading, (headingCounts.get(p.heading) ?? 0) + 1);
}

export function titleFor(page: SectionPage): string {
  const heading = page.heading ?? 'Nongshim';
  if ((headingCounts.get(heading) ?? 0) < 2) return heading;
  const section = SECTION_LABEL[page.section];
  return section ? `${heading} — ${section.name}` : heading;
}

export function crumbsFor(page: SectionPage): Crumb[] {
  const path = newPath(page.path);
  const crumbs: Crumb[] = [{ name: 'Home', path: '/' }];
  const section = SECTION_LABEL[page.section];
  if (section && !LANDING.has(path)) crumbs.push(section);
  crumbs.push({ name: page.heading ?? 'Page', path });
  return crumbs;
}

/** True for the landing page of a section (About, Sustainability, …). */
export const isLanding = (page: SectionPage) => LANDING.has(newSectionPath(page.path));

/**
 * The pages inside a section, with each one's own published description. A
 * section landing page renders this so it actually answers "what is in this
 * section?" — the source's landing pages carried a hero and little else.
 */
export function sectionIndex(page: SectionPage) {
  const own = newSectionPath(page.path);
  return sectionPages
    .filter((p) => p.section === page.section && newSectionPath(p.path) !== own && isLinkable(p))
    .map((p) => ({
      name: p.heading as string,
      path: newSectionPath(p.path),
      summary: describe(p),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Sibling links within the same section, for internal linking on every page. */
export function siblingsOf(page: SectionPage) {
  return sectionPages
    .filter((p) => p.section === page.section && p.path !== page.path && !BESPOKE_PATHS.has(p.path) && isLinkable(p))
    .map((p) => ({ name: p.heading as string, path: newPath(p.path) }));
}

/** Pages rendered by the generic section template. */
export const genericSectionPages = sectionPages.filter(
  (p) => !BESPOKE_PATHS.has(p.path) && isLinkable(p) && p.blocks.length > 0
);
