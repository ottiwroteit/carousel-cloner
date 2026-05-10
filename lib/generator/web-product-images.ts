import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

type FetchLike = typeof fetch;

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
  const imageSize = Math.min(result.width ?? 0, result.height ?? 0) >= 600 ? 2 : 0;

  return wordHits + firstWords + retailerBoost + imageSize;
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
  fetcher = fetch
}: FindWebProductImageOptions): Promise<WebProductImage> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });

  if (imageUrl) {
    const response = await fetcher(imageUrl, {
      headers: {
        "user-agent": USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`BARE product image failed with ${response.status} for ${productName}.`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    const extension = contentTypeToExtension(response.headers.get("content-type"));
    const filename = `slide-${String(index + 1).padStart(2, "0")}.${extension}`;
    const relativePath = path.join("generated", filename);
    await writeFile(path.join(jobDir, relativePath), bytes);

    return {
      sourceUrl: imageUrl,
      pageUrl,
      title,
      relativePath
    };
  }

  const query = `${productName} product package image`;
  const results = await searchDuckDuckGoImages(query, fetcher);
  const candidates = results
    .filter((result) => result.image?.startsWith("http"))
    .sort((a, b) => imageScore(b, productName) - imageScore(a, productName));

  for (const candidate of candidates.slice(0, 8)) {
    try {
      const response = await fetcher(candidate.image as string, {
        headers: {
          "user-agent": USER_AGENT
        }
      });

      if (!response.ok) {
        continue;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 10_000) {
        continue;
      }

      const extension = contentTypeToExtension(response.headers.get("content-type"));
      const filename = `slide-${String(index + 1).padStart(2, "0")}.${extension}`;
      const relativePath = path.join("generated", filename);
      await writeFile(path.join(jobDir, relativePath), bytes);

      return {
        sourceUrl: candidate.image as string,
        pageUrl: candidate.url,
        title: candidate.title,
        relativePath
      };
    } catch {
      continue;
    }
  }

  throw new Error(`No downloadable product image found for ${productName}.`);
}
