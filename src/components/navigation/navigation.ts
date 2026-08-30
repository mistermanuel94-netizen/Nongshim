/**
 * The site's primary navigation, mirroring the public source's information
 * architecture with product and recipe routes promoted to real paths.
 *
 * This is plain data rendered as real `<a href>` elements in the server HTML —
 * no JavaScript decides what a crawler can discover.
 */
export interface NavLink {
  label: string;
  path: string;
  /** Short description shown in the mega menu; also useful anchor context. */
  blurb?: string;
}

export interface NavSection {
  label: string;
  path: string;
  children: NavLink[];
}

export const NAV: NavSection[] = [
  {
    label: 'Products',
    path: '/products/',
    children: [
      { label: 'All products', path: '/products/', blurb: 'The complete Nongshim range' },
      { label: 'Instant Noodles', path: '/products/instant-noodles/', blurb: 'Shin Ramyun, Chapaghetti, Neoguri and more' },
      { label: 'Snacks', path: '/products/snacks/', blurb: 'Shrimp Crackers, Banana Kick, Onion Rings' },
      { label: 'Beverages', path: '/products/beverages/', blurb: 'Baeksan Artesian Water and more' },
      { label: 'Home Meal Replacement', path: '/products/home-meal-replacement/', blurb: 'The Cooktam range' },
    ],
  },
  {
    label: 'Recipes',
    path: '/recipes/',
    children: [{ label: 'All recipes', path: '/recipes/', blurb: 'Cooking ideas built on Nongshim noodles' }],
  },
  {
    label: 'SHIN',
    path: '/shin/',
    children: [{ label: 'Meet SHIN', path: '/shin/', blurb: 'The Shin Ramyun character, his story and profile' }],
  },
  {
    label: 'About',
    path: '/about/overview/',
    children: [
      { label: 'Overview', path: '/about/overview/', blurb: 'Who Nongshim is' },
      { label: 'Management philosophy', path: '/about/profile/mission/', blurb: 'Corporate philosophy and Vision 2025' },
      { label: 'The Nongshim way', path: '/about/profile/way/' },
      { label: 'History', path: '/about/history/', blurb: 'From 1965 to today' },
      { label: 'Corporate identity', path: '/about/ci/' },
      { label: 'Global network', path: '/about/global/', blurb: 'Subsidiaries across Asia, North America and Oceania' },
      { label: 'Group affiliates', path: '/about/group/' },
    ],
  },
  {
    label: 'Sustainability',
    path: '/sustainability/overview/',
    children: [
      { label: 'Overview', path: '/sustainability/overview/' },
      { label: 'Governance', path: '/sustainability/governance/governance/' },
      { label: 'Compliance', path: '/sustainability/governance/compliance/' },
      { label: 'Safety and health', path: '/sustainability/people/safety/' },
      { label: 'Shared growth', path: '/sustainability/people/shared/' },
      { label: 'Social contribution', path: '/sustainability/people/social/' },
      { label: 'Youlchon Foundation', path: '/sustainability/people/youlchon/' },
      { label: 'Climate response', path: '/sustainability/planet/response/' },
      { label: 'Sustainable packaging', path: '/sustainability/planet/sustainable/' },
      { label: 'Consumer-oriented management', path: '/sustainability/prosperity/consumer/' },
      { label: 'R&D', path: '/sustainability/prosperity/rnd/' },
      { label: 'Sustainability report', path: '/sustainability/report/' },
    ],
  },
  {
    label: 'Press',
    path: '/press/',
    children: [
      { label: 'Press centre', path: '/press/' },
      { label: 'Nongshim TV', path: '/pr/tv/', blurb: 'Brand and corporate films' },
      { label: 'Nongshim Baduk', path: '/press/baduk/' },
    ],
  },
  {
    label: 'Investors',
    path: '/investors/overview/',
    children: [
      { label: 'Overview', path: '/investors/overview/' },
      { label: 'Annual report', path: '/investors/report/' },
      { label: 'IR materials', path: '/investors/ir/' },
      { label: 'Audit reports', path: '/investors/audit/' },
    ],
  },
  {
    label: 'Contact',
    path: '/contact/overview/',
    children: [
      { label: 'Contact overview', path: '/contact/overview/' },
      { label: 'Locations', path: '/contact/location/' },
      { label: 'Enquiries', path: '/contact/inquiry/' },
    ],
  },
];

/** True when `current` is inside `section`, for aria-current marking. */
export function isActiveSection(section: NavSection, current: string): boolean {
  if (current === section.path) return true;
  return section.children.some((c) => current === c.path || current.startsWith(c.path));
}
