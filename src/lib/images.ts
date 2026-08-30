import type { ImageMetadata } from 'astro';

/**
 * Every downloaded source asset, eagerly resolved to Astro `ImageMetadata` so
 * the build can transcode to AVIF/WebP and emit `srcset`. Eager is correct
 * here: these are static imports resolved at build time, not runtime fetches.
 */
const files = import.meta.glob<{ default: ImageMetadata }>('../assets/source/*.{png,jpg,jpeg,gif,webp,avif}', {
  eager: true,
});

const byName = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(files)) {
  const name = path.split('/').pop();
  if (name) byName.set(name, mod.default);
}

/** A resolved image as produced by tools/build-content.mjs. */
export interface ContentImage {
  file: string;
  width: number | null;
  height: number | null;
  alt: string;
  sourceUrl: string;
}

export interface ResolvedImage {
  src: ImageMetadata;
  alt: string;
  sourceUrl: string;
}

/**
 * Resolve a content image record to build-time image metadata.
 * Returns null when the asset is unavailable, so callers render a real empty
 * state rather than a broken `<img>`.
 */
export function resolveImage(image: ContentImage | null | undefined): ResolvedImage | null {
  if (!image?.file) return null;
  const src = byName.get(image.file);
  if (!src) return null;
  return { src, alt: image.alt ?? '', sourceUrl: image.sourceUrl };
}

/** True when the asset exists in the build. */
export function hasImage(image: ContentImage | null | undefined): boolean {
  return Boolean(image?.file && byName.has(image.file));
}

/** Count of assets available to the build — used by the content validator. */
export const availableAssetCount = byName.size;
