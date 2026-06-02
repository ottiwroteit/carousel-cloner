import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { readBareCatalog, selectBareProducts, type BareProduct } from "@/lib/products/bare-catalog";

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("readBareCatalog", () => {
  test("loads only branded scannable products with images", async () => {
    root = await mkdtemp(path.join(tmpdir(), "bare-catalog-"));
    await writeFile(
      path.join(root, "bare_products_with_images.csv"),
      `barcode,brand,product_name,category,score,label,image_url,source,summary,created_at,updated_at
123,Siete,"Sea Salt, Tortilla Chips",Snacks,95,Excellent,https://example.com/siete.png,manual,Great chips,now,now
456,Unknown,Good Product,Snacks,90,Excellent,https://example.com/unknown.png,manual,Skip,now,now
789,Brand,789,Snacks,90,Excellent,https://example.com/bad.png,manual,Skip,now,now
999,Brand,Missing Image,Snacks,90,Excellent,,manual,Skip,now,now
777,Kirkland Signature,Hickory Smoked Bacon,Protein,48,Limit,https://example.com/bacon.png,manual,"Pork belly, salt, sugar.",now,now
888,Fresh Brand,Chicken Breast,Protein,90,Excellent,https://example.com/chicken.png,manual,Raw chicken breast package,now,now
889,Heinz,Distilled white vinegar(unidades),Pantry,99,Excellent,https://example.com/vinegar.png,manual,Malformed import name,now,now
`,
      "utf8"
    );

    const products = await readBareCatalog({ dataDir: root });

    expect(products).toEqual([
      {
        barcode: "123",
        brand: "Siete",
        productName: "Sea Salt, Tortilla Chips",
        category: "Snacks",
        score: 95,
        label: "Excellent",
        imageUrl: "https://example.com/siete.png",
        source: "manual",
        summary: "Great chips"
      }
    ]);
  });

  test("selects unique products", () => {
    const products = [
      { barcode: "1", brand: "A", productName: "One", category: "Snacks", score: 90, label: "Good", imageUrl: "a", source: "x", summary: "" },
      { barcode: "2", brand: "B", productName: "Two", category: "Snacks", score: 91, label: "Good", imageUrl: "b", source: "x", summary: "" }
    ];

    expect(selectBareProducts(products, 2, () => 0).map((product) => product.barcode)).toEqual(["1", "2"]);
  });

  test("prefers high-scoring products for generated posts", () => {
    const products: BareProduct[] = [
      { barcode: "1", brand: "A", productName: "Avoid", category: "Snacks", score: 38, label: "Avoid", imageUrl: "a", source: "x", summary: "" },
      { barcode: "2", brand: "B", productName: "Excellent", category: "Snacks", score: 95, label: "Excellent", imageUrl: "b", source: "x", summary: "" }
    ];

    expect(selectBareProducts(products, 1, () => 0).map((product) => product.barcode)).toEqual(["2"]);
  });

  test("avoids private-label products that do not match the selected store", () => {
    const products: BareProduct[] = [
      {
        barcode: "1",
        brand: "Kirkland Signature",
        productName: "Salted Mixed Nuts",
        category: "Snacks",
        score: 95,
        label: "Excellent",
        imageUrl: "a",
        source: "x",
        summary: ""
      },
      {
        barcode: "2",
        brand: "Cocojune",
        productName: "Organic Coconut Yogurt",
        category: "Yogurt",
        score: 99,
        label: "Excellent",
        imageUrl: "b",
        source: "x",
        summary: ""
      }
    ];

    expect(selectBareProducts(products, 1, () => 0, { storeName: "Sprouts" }).map((product) => product.barcode)).toEqual(["2"]);
  });
});
