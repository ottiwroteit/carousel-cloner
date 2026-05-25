import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import sharp from "sharp";
import { findWebProductImage } from "@/lib/generator/web-product-images";

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("findWebProductImage", () => {
  test("downloads the best product image candidate", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-web-product-"));
    const bytes = await sharp({
      create: {
        width: 1200,
        height: 1200,
        channels: 4,
        background: "#f4f4f4"
      }
    })
      .composite([
        {
          input: Buffer.from('<svg width="760" height="760"><rect width="760" height="760" fill="#111111"/></svg>'),
          left: 220,
          top: 220
        }
      ])
      .jpeg()
      .toBuffer();
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://duckduckgo.com/?")) {
        return new Response('<script>vqd="test-token"</script>');
      }
      if (url.startsWith("https://duckduckgo.com/i.js")) {
        return Response.json({
          results: [
            {
              image: "https://cdn.example.com/product.jpg",
              title: "Kettle Cooked Olive Oil Potato Chips",
              url: "https://www.heb.com/product-detail/example",
              width: 1200,
              height: 1200
            }
          ]
        });
      }
      return new Response(bytes, { headers: { "content-type": "image/jpeg" } });
    };

    const result = await findWebProductImage({
      jobDir: root,
      productName: "Kettle Cooked Olive Oil Potato Chips",
      index: 1,
      fetcher
    });

    expect(result).toMatchObject({
      relativePath: "generated/slide-02.jpg",
      sourceUrl: "https://cdn.example.com/product.jpg"
    });
    await expect(readFile(path.join(root, result.relativePath))).resolves.toEqual(bytes);
  });

  test("rejects low-quality catalog images and falls back to image search", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-web-product-"));
    const badCatalogBytes = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: "#ffffff"
      }
    })
      .composite([
        {
          input: Buffer.from('<svg width="400" height="80"><rect width="400" height="80" fill="#111111"/></svg>'),
          left: 0,
          top: 160
        }
      ])
      .jpeg()
      .toBuffer();
    const goodSearchBytes = await sharp({
      create: {
        width: 1400,
        height: 1400,
        channels: 4,
        background: "#f5f5f5"
      }
    })
      .composite([
        {
          input: Buffer.from('<svg width="900" height="900"><rect width="900" height="900" fill="#111111"/></svg>'),
          left: 250,
          top: 250
        }
      ])
      .jpeg()
      .toBuffer();
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url === "https://bare.example.com/low-quality.jpg") {
        return new Response(badCatalogBytes, { headers: { "content-type": "image/jpeg" } });
      }
      if (url.startsWith("https://duckduckgo.com/?")) {
        return new Response('<script>vqd="test-token"</script>');
      }
      if (url.startsWith("https://duckduckgo.com/i.js")) {
        return Response.json({
          results: [
            {
              image: "https://cdn.example.com/better-product.jpg",
              title: "Kirkland Signature Hickory Smoked Bacon",
              url: "https://www.example.com/product",
              width: 1400,
              height: 1400
            }
          ]
        });
      }
      return new Response(goodSearchBytes, { headers: { "content-type": "image/jpeg" } });
    };

    const result = await findWebProductImage({
      jobDir: root,
      productName: "Kirkland Signature Hickory Smoked Bacon",
      index: 2,
      imageUrl: "https://bare.example.com/low-quality.jpg",
      fetcher
    });

    expect(result).toMatchObject({
      relativePath: "generated/slide-03.jpg",
      sourceUrl: "https://cdn.example.com/better-product.jpg"
    });
    await expect(readFile(path.join(root, result.relativePath))).resolves.toEqual(goodSearchBytes);
  });
});
