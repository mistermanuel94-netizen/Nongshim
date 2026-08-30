import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config/site-url.mjs';

export default defineConfig({
  site: SITE_URL,
  // Every page on this site is content that can be pre-rendered. Static output
  // removes TTFB variance and lets the whole site sit on a CDN edge.
  output: 'static',
  // One canonical URL form. Paired with the canonical tag and the redirect map,
  // this removes the trailing-slash duplicate class entirely.
  trailingSlash: 'always',
  build: {
    // Emit /path/index.html so static hosts serve clean URLs without rewrites.
    format: 'directory',
    // The whole stylesheet is ~4 KB compressed; inlining removes a
    // render-blocking request that costs more than the bytes it saves.
    inlineStylesheets: 'always',
    assets: '_assets',
  },
  image: {
    // Ship modern formats; sharp handles AVIF/WebP encode at build time.
    responsiveStyles: true,
    layout: 'constrained',
  },
  integrations: [
    sitemap({
      // Only canonical, indexable URLs belong in the sitemap.
      filter: (page) => !/\/(404|search)\/?$/.test(page),
      serialize(item) {
        const path = new URL(item.url).pathname;
        if (path === '/') return { ...item, changefreq: 'weekly', priority: 1.0 };
        if (/^\/products\/[^/]+\/$/.test(path)) return { ...item, changefreq: 'monthly', priority: 0.8 };
        if (/^\/recipes\/[^/]+\/$/.test(path)) return { ...item, changefreq: 'monthly', priority: 0.7 };
        if (/^\/(products|recipes)\/$/.test(path)) return { ...item, changefreq: 'weekly', priority: 0.9 };
        return { ...item, changefreq: 'monthly', priority: 0.5 };
      },
    }),
  ],
  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});
