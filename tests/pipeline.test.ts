import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import sharp from "sharp";
import { createJob, readJob, readJobTextArtifact } from "@/lib/jobs/store";
import { processJob } from "@/lib/generator/pipeline";
import type { StyleProfile } from "@/lib/types";

const profile: StyleProfile = {
  accountName: "Carousel Cloner",
  targetAudience: "founders posting daily",
  topics: ["automation", "AI workflows"],
  tone: "direct and useful",
  captionRules: "write like a smart operator",
  imageStyle: "clean app UI screenshots with crisp text",
  bannedElements: ["hype"],
  ctaStyle: "ask a practical question"
};

let root: string | undefined;

function bareCatalogProducts() {
  return [
    {
      barcode: "111",
      brand: "Siete",
      productName: "Sea Salt Tortilla Chips",
      category: "Snacks",
      score: 95,
      label: "Excellent",
      imageUrl: "https://example.com/siete.png",
      source: "manual",
      summary: ""
    },
    {
      barcode: "222",
      brand: "Primal Kitchen",
      productName: "Ketchup",
      category: "Pantry",
      score: 90,
      label: "Excellent",
      imageUrl: "https://example.com/ketchup.png",
      source: "manual",
      summary: ""
    },
    {
      barcode: "333",
      brand: "Spindrift",
      productName: "Lemon Sparkling Water",
      category: "Beverages",
      score: 88,
      label: "Good",
      imageUrl: "https://example.com/spindrift.png",
      source: "manual",
      summary: ""
    }
  ];
}

async function writeFakeProductSource(jobDir: string, index: number): Promise<string> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });
  const relativePath = path.join("generated", `source-${index}.jpg`);
  await writeFile(
    path.join(jobDir, relativePath),
    await sharp({
      create: {
        width: 900,
        height: 900,
        channels: 4,
        background: "#ffffff"
      }
    })
      .composite([
        {
          input: Buffer.from('<svg width="700" height="700"><rect width="700" height="700" fill="#111111"/></svg>'),
          left: 100,
          top: 100
        }
      ])
      .jpeg()
      .toBuffer()
  );
  return relativePath;
}

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("processJob", () => {
  test("creates fallback analysis, package, and captions when extraction fails", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-pipeline-"));
    const job = await createJob({ url: "https://www.tiktok.com/@creator/video/1", profile }, root);

    const snapshot = await processJob(job.status.id, {
      root,
      readBareCatalog: async () => bareCatalogProducts(),
      findWebProductImage: async ({ jobDir, imageUrl, index, productName }) => ({
        sourceUrl: imageUrl as string,
        pageUrl: `bare://product/${index}`,
        title: productName,
        relativePath: await writeFakeProductSource(jobDir, index)
      }),
      extract: async () => ({
        ok: false,
        error: {
          code: "blocked",
          message: "TikTok blocked direct extraction for this URL."
        }
      })
    });

    const captions = await readJobTextArtifact(job.status.id, "captions.txt", root);
    const readBack = await readJob(job.status.id, root);

    expect(snapshot.status.state).toBe("ready");
    expect(readBack.artifacts["analysis.json"]).toMatchObject({
      hook: "Direct TikTok extraction was blocked"
    });
    expect(readBack.artifacts["package.json"]).toMatchObject({
      generatedImages: [
        "generated/slide-01.svg",
        "generated/slide-02.png",
        "generated/slide-03.png",
        "generated/slide-04.png"
      ]
    });
    expect((readBack.artifacts["package.json"] as { carouselSlides: Array<{ kind: string }> }).carouselSlides.map((slide) => slide.kind)).toEqual([
      "storefront-hook",
      "product-photo",
      "bare-screenshot",
      "product-photo",
      "bare-screenshot",
      "product-photo",
      "bare-screenshot"
    ]);
    expect(readBack.artifacts["image-generation.json"]).toMatchObject({
      provider: "local-real-products",
      reason: "Local mode is using BARE product images."
    });
    expect(captions).toContain("Main caption:");
  });

  test("falls back to local images when OpenAI image generation fails", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-pipeline-"));
    const job = await createJob({ url: "https://www.tiktok.com/@creator/video/1", profile }, root);

    const snapshot = await processJob(job.status.id, {
      root,
      hasOpenAIKey: true,
      useOpenAIImages: true,
      readBareCatalog: async () => bareCatalogProducts(),
      findWebProductImage: async ({ jobDir, imageUrl, index, productName }) => ({
        sourceUrl: imageUrl as string,
        pageUrl: `bare://product/${index}`,
        title: productName,
        relativePath: await writeFakeProductSource(jobDir, index)
      }),
      extract: async () => ({
        ok: false,
        error: {
          code: "blocked",
          message: "TikTok blocked direct extraction for this URL."
        }
      }),
      generateOpenAIImages: async () => {
        throw new Error("Invalid image model");
      }
    });

    const readBack = await readJob(job.status.id, root);

    expect(snapshot.status.state).toBe("ready");
    expect(readBack.artifacts["image-generation.json"]).toMatchObject({
      provider: "local-svg",
      reason: "OpenAI/web image generation failed: Invalid image model"
    });
    expect(readBack.artifacts["package.json"]).toMatchObject({
      generatedImages: [
        "generated/slide-01.svg",
        "generated/slide-02.svg",
        "generated/slide-03.svg",
        "generated/slide-04.svg"
      ]
    });
  });

  test("requires BARE catalog products instead of inventing fallback products", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-pipeline-"));
    const job = await createJob({ url: "https://www.tiktok.com/@creator/video/1", profile }, root);

    await expect(
      processJob(job.status.id, {
        root,
        readBareCatalog: async () => [],
        extract: async () => ({
          ok: false,
          error: {
            code: "blocked",
            message: "TikTok blocked direct extraction for this URL."
          }
        })
      })
    ).rejects.toThrow("BARE catalog did not return any marketable products with images.");
  });

  test("uses BARE catalog products when available", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-pipeline-"));
    const job = await createJob({ url: "https://www.tiktok.com/@creator/video/1", profile }, root);

    const snapshot = await processJob(job.status.id, {
      root,
      hasOpenAIKey: true,
      useOpenAIImages: true,
      readBareCatalog: async () => bareCatalogProducts(),
      extract: async () => ({
        ok: false,
        error: {
          code: "blocked",
          message: "TikTok blocked direct extraction for this URL."
        }
      }),
      generateOpenAIImages: async () => ["generated/slide-01.png"],
      findWebProductImage: async ({ imageUrl, index, productName }) => ({
        sourceUrl: imageUrl as string,
        pageUrl: `bare://product/${index}`,
        title: productName,
        relativePath: `generated/slide-0${index + 1}.png`
      })
    });

    const readBack = await readJob(job.status.id, root);
    const pkg = readBack.artifacts["package.json"] as { carouselSlides: Array<{ productName?: string; barcode?: string }> };

    expect(snapshot.status.state).toBe("ready");
    expect(pkg.carouselSlides.filter((slide) => slide.productName).map((slide) => slide.barcode).sort()).toEqual([
      "111",
      "111",
      "222",
      "222",
      "333",
      "333"
    ]);
    expect(
      (
        readBack.artifacts["bare-product-selection.json"] as Array<{
          barcode: string;
          brand: string;
          productName: string;
        }>
      )
        .map((product) => product.barcode)
        .sort()
    ).toEqual(["111", "222", "333"]);
  });
});
