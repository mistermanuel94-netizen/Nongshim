/**
 * Canonical site configuration. Shared by astro.config.mjs (which cannot import
 * TypeScript) and by the site itself via src/config/site.ts.
 *
 * SITE_URL must be the production origin: canonical tags, the sitemap, OG URLs
 * and the structured-data @id graph are all derived from it.
 */
export const SITE_URL = process.env.SITE_URL ?? 'https://eng.nongshim.com';
