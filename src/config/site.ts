import { SITE_URL } from './site-url.mjs';

export { SITE_URL };

/**
 * Organization facts. Every value here is taken from the public source site or
 * from a public Nongshim property linked by it — nothing is inferred.
 * `sameAs` lists only profiles the source site itself links to.
 */
export const ORGANIZATION = {
  name: 'Nongshim',
  legalName: 'Nongshim Co., Ltd.',
  url: SITE_URL,
  logo: '/brand/nongshim-logo.svg',
  foundingDate: '1965',
  // Source: /contact/location — "Korea | HQ".
  address: {
    streetAddress: '112 Yeouidaebang-Ro, Dongjak-Gu',
    addressLocality: 'Seoul',
    addressCountry: 'KR',
  },
  telephone: '080-023-5181',
  sameAs: [
    'https://www.facebook.com/nongshim',
    'https://www.facebook.com/nongshimworldwide/',
    'https://www.instagram.com/nongshim/',
    'https://www.instagram.com/nongshimglobal',
    'https://www.tiktok.com/@nongshimglobal',
    'https://www.youtube.com/user/nongshimPR',
  ],
  // Alternate-language corporate sites the source links to. These are separate
  // sites, not translations of these URLs, so they are NOT emitted as hreflang.
  otherLanguageSites: [
    { lang: 'ko', url: 'https://www.nongshim.com', label: 'Korean' },
    { lang: 'zh', url: 'https://cn.nongshim.com', label: 'Chinese' },
  ],
} as const;

export const SITE = {
  name: 'Nongshim',
  /** Used only where a page supplies no title of its own. */
  defaultTitle: 'Nongshim — Korean Instant Noodles, Snacks and Recipes',
  titleSuffix: 'Nongshim',
  defaultDescription:
    'Nongshim is a Korean food company founded in 1965, known for Shin Ramyun, Chapaghetti, Neoguri and Shrimp Crackers. Browse the product range, cooking recipes and company information.',
  locale: 'en',
  ogLocale: 'en_US',
} as const;
