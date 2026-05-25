import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import sharp from "sharp";
import { createJob, readJob } from "@/lib/jobs/store";
import { processJob } from "@/lib/generator/pipeline";
import type { GeneratedPackage, StyleProfile } from "@/lib/types";

const profile: StyleProfile = {
  accountName: "Carousel Cloner",
  targetAudience: "grocery creators",
  topics: [],
  tone: "direct",
  captionRules: "short",
  imageStyle: "vertical grocery photos",
  bannedElements: [],
  ctaStyle: "save this"
};

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("local product images", () => {
  test("uses BARE product image URLs in local mode instead of placeholder product SVGs", async () => {
    root = await mkdtemp(path.join(tmpdir(), "local-product-images-"));
    const job = await createJob({ url: "https://www.tiktok.com/@creator/video/1", profile }, root);

    await processJob(job.status.id, {
      root,
      useOpenAIImages: false,
      readBareCatalog: async () => [
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
      ],
      extract: async () => ({
        ok: false,
        error: {
          code: "blocked",
          message: "TikTok blocked direct extraction for this URL."
        }
      }),
      findWebProductImage: async ({ jobDir, index, imageUrl, productName }) => {
        const generatedDir = path.join(jobDir, "generated");
        await mkdir(generatedDir, { recursive: true });
        const relativePath = `generated/source-${index}.png`;
        await writeFile(
          path.join(jobDir, relativePath),
          await sharp({ create: { width: 600, height: 600, channels: 4, background: "#ffffff" } }).png().toBuffer()
        );
        return {
          sourceUrl: imageUrl as string,
          pageUrl: `bare://product/${index}`,
          title: productName,
          relativePath
        };
      }
    });

    const readBack = await readJob(job.status.id, root);
    const pkg = readBack.artifacts["package.json"] as GeneratedPackage;

    expect(readBack.artifacts["image-generation.json"]).toMatchObject({
      provider: "local-real-products"
    });
    expect(pkg.generatedImages).toEqual([
      "generated/slide-01.png",
      "generated/slide-02.png",
      "generated/slide-03-bare-proof.png",
      "generated/slide-03.png",
      "generated/slide-05-bare-proof.png",
      "generated/slide-04.png",
      "generated/slide-07-bare-proof.png"
    ]);

    const productMeta = await sharp(await readFile(path.join(readBack.dir, "generated/slide-02.png"))).metadata();
    expect(productMeta.width).toBe(1080);
    expect(productMeta.height).toBe(1920);
    const proofMeta = await sharp(await readFile(path.join(readBack.dir, "generated/slide-03-bare-proof.png"))).metadata();
    expect(proofMeta.width).toBe(1080);
    expect(proofMeta.height).toBe(1920);
  });
});
