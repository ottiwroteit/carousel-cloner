import sharp from "sharp";
import { fetchWithCurlFallback } from "@/lib/http";
import type { BareProduct } from "@/lib/products/bare-catalog";

const MIN_IMAGE_BYTES = 6_000;
const MIN_EDGE = 120;
const MIN_VARIANCE = 12;
const MIN_NON_WHITE_RATIO = 0.04;
const MAX_TRANSPARENT_RATIO = 0.65;

const verdictCache = new Map<string, boolean>();

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

function cacheKey(product: BareProduct): string {
  return `${product.barcode}:${product.imageUrl}`;
}

export async function hasUsableProductImage(
  product: BareProduct,
  fetcher: FetchLike = fetchWithCurlFallback
): Promise<boolean> {
  const key = cacheKey(product);
  const cached = verdictCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  try {
    if (!product.imageUrl || /^null$/i.test(product.imageUrl)) {
      throw new Error("missing image URL");
    }

    const response = await fetcher(product.imageUrl);
    if (!response.ok) {
      throw new Error(`image returned ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < MIN_IMAGE_BYTES) {
      throw new Error("image file is too small");
    }

    const image = sharp(bytes, { failOn: "none" }).rotate().ensureAlpha();
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (Math.min(width, height) < MIN_EDGE) {
      throw new Error("image dimensions are too small");
    }

    const sample = await image
      .resize({ width: 128, height: 128, fit: "inside", withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = sample.info.channels;
    const pixels = sample.info.width * sample.info.height;
    let nonWhitePixels = 0;
    let transparentPixels = 0;
    let luminanceSum = 0;
    let luminanceSquaredSum = 0;

    for (let index = 0; index < sample.data.length; index += channels) {
      const red = sample.data[index] ?? 0;
      const green = sample.data[index + 1] ?? 0;
      const blue = sample.data[index + 2] ?? 0;
      const alpha = channels >= 4 ? sample.data[index + 3] ?? 255 : 255;
      const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      luminanceSum += luminance;
      luminanceSquaredSum += luminance * luminance;
      if (alpha < 32) {
        transparentPixels += 1;
      }
      if (alpha > 32 && (red < 245 || green < 245 || blue < 245)) {
        nonWhitePixels += 1;
      }
    }

    const mean = luminanceSum / pixels;
    const variance = Math.sqrt(Math.max(0, luminanceSquaredSum / pixels - mean * mean));
    const nonWhiteRatio = nonWhitePixels / pixels;
    const transparentRatio = transparentPixels / pixels;

    if (transparentRatio > MAX_TRANSPARENT_RATIO) {
      throw new Error("image is mostly transparent");
    }
    if (nonWhiteRatio < MIN_NON_WHITE_RATIO || variance < MIN_VARIANCE) {
      throw new Error("image looks like a blank or placeholder asset");
    }

    verdictCache.set(key, true);
    return true;
  } catch {
    verdictCache.set(key, false);
    return false;
  }
}

export async function filterProductsWithUsableImages(products: BareProduct[]): Promise<BareProduct[]> {
  const verdicts = await Promise.all(products.map((product) => hasUsableProductImage(product)));
  return products.filter((_, index) => verdicts[index]);
}
