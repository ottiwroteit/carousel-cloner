import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fetchWithCurlFallback } from "@/lib/http";

type DuckDuckGoImageResult = {
  image?: string;
  title?: string;
  url?: string;
  width?: number;
  height?: number;
};

type DuckDuckGoImageResponse = {
  results?: DuckDuckGoImageResult[];
};

export type WebProductImage = {
  sourceUrl: string;
  pageUrl?: string;
  title?: string;
  relativePath: string;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type FindWebProductImageOptions = {
  jobDir: string;
  productName: string;
  index: number;
  imageUrl?: string;
  pageUrl?: string;
  title?: string;
  fetcher?: FetchLike;
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const MIN_IMAGE_BYTES = 8_000;
const MIN_SOURCE_EDGE = 700;
const MIN_TRIMMED_EDGE = 260;
const MIN_TRIMMED_AREA = 220_000;

function contentTypeToExtension(contentType: string | null): "jpg" | "png" | "webp" {
  if (contentType?.includes("png")) {
    return "png";
  }
  if (contentType?.includes("webp")) {
    return "webp";
  }
  return "jpg";
}

function parseVqd(html: string): string | undefined {
  return html.match(/vqd="([^"]+)/)?.[1] ?? html.match(/vqd=([^&,]+)/)?.[1]?.replace(/^"|"$/g, "");
}

function imageScore(result: DuckDuckGoImageResult, productName: string): number {
  const haystack = `${result.title ?? ""} ${result.url ?? ""} ${result.image ?? ""}`.toLowerCase();
  const productWords = productName.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  const wordHits = productWords.filter((word) => haystack.includes(word)).length;
  const firstWords = productWords.slice(0, 2).filter((word) => haystack.includes(word)).length * 4;
  const retailerBoost = /(heb|kroger|target|walmart|publix|sprouts|traderjoes|trader-joe|wholefoods|instacart|nuts\.com)/.test(haystack) ? 4 : 0;
  const imageSize = Math.min(result.width ?? 0, result.height ?? 0) >= MIN_SOURCE_EDGE ? 3 : -4;

  return wordHits + firstWords + retailerBoost + imageSize;
}

async function assertUsableProductImage(bytes: Buffer, productName: string): Promise<void> {
  if (bytes.length < MIN_IMAGE_BYTES) {
    throw new Error(`Product image is too small for ${productName}.`);
  }

  const image = sharp(bytes).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (Math.min(width, height) < MIN_SOURCE_EDGE) {
    throw new Error(`Product image resolution is too low for ${productName}.`);
  }

  const trimmed = await image
    .trim({
      background: "#ffffff",
      threshold: 24
    })
    .metadata();
  const trimmedWidth = trimmed.width ?? width;
  const trimmedHeight = trimmed.height ?? height;

  if (Math.min(trimmedWidth, trimmedHeight) < MIN_TRIMMED_EDGE || trimmedWidth * trimmedHeight < MIN_TRIMMED_AREA) {
    throw new Error(`Product image crop is too thin for ${productName}.`);
  }
}

async function downloadCandidateImage({
  jobDir,
  productName,
  index,
  sourceUrl,
  fetcher
}: {
  jobDir: string;
  productName: string;
  index: number;
  sourceUrl: string;
  fetcher: FetchLike;
}): Promise<{ relativePath: string; contentType: string | null }> {
  const response = await fetcher(sourceUrl, {
    headers: {
      "user-agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Product image failed with ${response.status} for ${productName}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await assertUsableProductImage(bytes, productName);

  const contentType = response.headers.get("content-type");
  const extension = contentTypeToExtension(contentType);
  const filename = `slide-${String(index + 1).padStart(2, "0")}.${extension}`;
  const relativePath = path.join("generated", filename);
  await writeFile(path.join(jobDir, relativePath), bytes);

  return { relativePath, contentType };
}

async function searchDuckDuckGoImages(query: string, fetcher: FetchLike): Promise<DuckDuckGoImageResult[]> {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
  const page = await fetcher(searchUrl, {
    headers: {
      "user-agent": USER_AGENT
    }
  });
  const html = await page.text();
  const vqd = parseVqd(html);

  if (!vqd) {
    throw new Error("DuckDuckGo did not return an image search token.");
  }

  const imageUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,&p=1`;
  const response = await fetcher(imageUrl, {
    headers: {
      "user-agent": USER_AGENT,
      referer: "https://duckduckgo.com/"
    }
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo image search failed with ${response.status}.`);
  }

  const data = (await response.json()) as DuckDuckGoImageResponse;
  return data.results ?? [];
}

export async function findWebProductImage({
  jobDir,
  productName,
  index,
  imageUrl,
  pageUrl,
  title,
  fetcher = fetchWithCurlFallback
}: FindWebProductImageOptions): Promise<WebProductImage> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });

  if (imageUrl) {
    try {
      const downloaded = await downloadCandidateImage({
        jobDir,
        productName,
        index,
        sourceUrl: imageUrl,
        fetcher
      });

      return {
        sourceUrl: imageUrl,
        pageUrl,
        title,
        relativePath: downloaded.relativePath
      };
    } catch {
      // Fall through to web search when the BARE catalog image is too small, too cropped, or unavailable.
    }
  }

  const query = `${productName} product package image`;
  const results = await searchDuckDuckGoImages(query, fetcher);
  const candidates = results
    .filter((result) => result.image?.startsWith("http"))
    .sort((a, b) => imageScore(b, productName) - imageScore(a, productName));

  for (const candidate of candidates.slice(0, 8)) {
    try {
      const downloaded = await downloadCandidateImage({
        jobDir,
        productName,
        index,
        sourceUrl: candidate.image as string,
        fetcher
      });

      return {
        sourceUrl: candidate.image as string,
        pageUrl: candidate.url,
        title: candidate.title,
        relativePath: downloaded.relativePath
      };
    } catch {
      continue;
    }
  }

  throw new Error(`No downloadable product image found for ${productName}.`);
}
