/**
 * Route configuration shared by the site and the audit tooling.
 *
 * Kept as plain `.mjs` so `tools/ia.mjs` (which generates the redirect map) and
 * the TypeScript site modules read the same values. If these drift, the
 * redirect map and the built routes disagree — so they must not drift.
 */

/** Source section path -> new path, for pages that were renamed. */
export const RENAMED_SECTIONS = {
  '/about/globalNongshim': '/about/global/',
  '/investors/ir/list': '/investors/ir/',
  '/investors/finance/audit_list': '/investors/audit/',
  '/pr/overview': '/press/',
  '/pr/baduk': '/press/baduk/',
};

/** Source section paths that keep their path (a trailing slash is added). */
export const PRESERVED_SECTIONS = [
  '/about/overview',
  '/about/profile/mission',
  '/about/profile/way',
  '/about/history',
  '/about/ci',
  '/about/globalNongshim',
  '/about/group',
  '/about/group/holdings',
  '/about/group/hotelNongshim',
  '/about/group/megaMart',
  '/about/group/nds',
  '/about/group/nongshimCommunication',
  '/about/group/nongshimDevelopment',
  '/about/group/nongshimEngineering',
  '/about/group/rfm',
  '/about/group/taekyungNongsan',
  '/about/group/youlchonChemical',
  '/about/group/youlchonFoundation',
  '/sustainability/overview',
  '/sustainability/governance/governance',
  '/sustainability/governance/compliance',
  '/sustainability/people/safety',
  '/sustainability/people/shared',
  '/sustainability/people/social',
  '/sustainability/people/youlchon',
  '/sustainability/planet/response',
  '/sustainability/planet/sustainable',
  '/sustainability/prosperity/consumer',
  '/sustainability/prosperity/rnd',
  '/sustainability/report',
  '/pr/overview',
  '/pr/baduk',
  '/pr/tv',
  '/investors/overview',
  '/investors/report',
  '/investors/ir/list',
  '/investors/finance/audit_list',
  '/contact/overview',
  '/contact/location',
  '/contact/inquiry',
];

/**
 * Source paths that produce no page at all: they either rendered an empty
 * document or were a stateful step of a flow this static site does not have.
 * Each is covered by a redirect (see tools/ia.mjs) and must never be linked.
 */
export const REMOVED_SECTION_PATHS = ['/pr/pedia', '/pr/pedia/detail', '/contact/inquiry_check'];

/** Pages rendered by a bespoke template rather than the generic renderer. */
export const BESPOKE_SECTION_PATHS = [
  '/about/history',
  // The source served /about/group as a byte-identical copy of the Holdings
  // page; it is replaced here by a real affiliates index.
  '/about/group',
  '/about/globalNongshim',
  '/contact/location',
  '/pr/tv',
  '/pr/pedia',
  '/pr/pedia/detail',
  '/contact/inquiry_check',
  '/contact/inquiry',
];

/** Legacy `?tabType=` value -> new category path. */
export const LEGACY_CATEGORY_TABS = {
  instant: '/products/instant-noodles/',
  snacks: '/products/snacks/',
  beverages: '/products/beverages/',
  simple: '/products/home-meal-replacement/',
};

/** How many recipes each index page shows. */
export const RECIPES_PER_PAGE = 24;

/** How many list pages the source's recipe index had (for redirect mapping). */
export const LEGACY_RECIPE_PAGES = 7;

export const newSectionPath = (sourcePath) => RENAMED_SECTIONS[sourcePath] ?? `${sourcePath}/`;
