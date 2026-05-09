import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
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
    const bytes = Buffer.alloc(12_000, 1);
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
});
