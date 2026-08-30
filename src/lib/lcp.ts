/**
 * LCP image preparation.
 *
 * The largest contentful paint on most templates is one specific image. Waiting
 * for the browser to discover it in the document body costs a round trip on a
 * slow connection, so it is prepared once in page frontmatter: the same call
 * produces the `<img>` attributes and the matching `<link rel="preload">`,
 * which guarantees the preload and the rendered element cannot disagree (a
 * mismatched preload is worse than none — it downloads a second image).
 *
 * Only ever used for the actual LCP element on a page. Everything else lazy
 * loads.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { ResolvedImage } from './images';

export interface PreloadDescriptor {
  href: string;
  srcset?: string;
  sizes?: string;
}

export interface PreparedImage {
  attrs: {
    src: string;
    srcset?: string;
    sizes?: string;
    width: number;
    height: number;
    alt: string;
    loading: 'eager';
    fetchpriority: 'high';
    decoding: 'async';
  };
  preload: PreloadDescriptor;
}

interface Options {
  widths: number[];
  sizes: string;
}

/**
 * Prepare an image as the page's LCP element.
 * Returns null when the image is unavailable, so callers can render their
 * empty state instead of a broken element.
 */
export async function prepareLcpImage(
  image: ResolvedImage | null | undefined,
  { widths, sizes }: Options
): Promise<PreparedImage | null> {
  if (!image) return null;

  const source: ImageMetadata = image.src;
  // Never upscale past the source's intrinsic width.
  const usable = widths.filter((w) => w <= source.width);
  if (!usable.length) usable.push(source.width);

  const optimised = await getImage({
    src: source,
    widths: usable,
    sizes,
    format: 'webp',
  });

  const srcset = optimised.srcSet?.attribute || undefined;

  return {
    attrs: {
      src: optimised.src,
      srcset,
      sizes: srcset ? sizes : undefined,
      width: Number(optimised.attributes.width ?? source.width),
      height: Number(optimised.attributes.height ?? source.height),
      alt: image.alt,
      loading: 'eager',
      fetchpriority: 'high',
      decoding: 'async',
    },
    preload: { href: optimised.src, srcset, sizes: srcset ? sizes : undefined },
  };
}
