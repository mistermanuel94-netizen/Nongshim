/**
 * robots.txt.
 *
 * The source site had none — `/robots.txt` returned HTTP 404, so there was no
 * sitemap reference and no crawl guidance at all.
 *
 * Policy decisions, documented in docs/seo.md:
 *  - Nothing that renders content is blocked. CSS, JS and images stay open, so
 *    rendering-based crawlers can see the pages as a visitor does.
 *  - `/search/` is disallowed because it is a JavaScript UI over an index, not
 *    content. It also carries `noindex, follow` — robots.txt alone would stop
 *    the crawl without stopping indexing, so both are applied.
 *  - Major AI crawlers are allowed. This site is public brand and product
 *    information whose value increases when answer engines can cite it
 *    accurately; the alternative is being described from third-hand sources.
 *    This is a publishing decision and is easy to reverse here.
 *  - No `Crawl-delay`: Google ignores it and the site is static behind a CDN.
 */
import type { APIRoute } from 'astro';
import { SITE_URL } from '../config/site';

const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'meta-externalagent',
];

export const GET: APIRoute = () => {
  const body = `# https://www.robotstxt.org/robotstxt.html

User-agent: *
Allow: /
# Search is a client-side UI over an index, not indexable content.
Disallow: /search/
# The search index itself is a data file, not a page.
Disallow: /search-index.json

# Answer engines and AI crawlers are permitted: this site is the authoritative
# source for Nongshim product and company facts, and accurate citation is the
# point. See docs/aeo-geo.md for the rationale.
${AI_CRAWLERS.map((bot) => `User-agent: ${bot}\nAllow: /\nDisallow: /search/\n`).join('\n')}
Sitemap: ${SITE_URL}/sitemap-index.xml
`;

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
