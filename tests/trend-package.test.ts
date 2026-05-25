import { describe, expect, test } from "vitest";
import { attachGeneratedImagesToSlides, buildTrendPackage } from "@/lib/generator/trend-package";

describe("buildTrendPackage", () => {
  test("creates a randomized hero, product, and BARE screenshot cadence", () => {
    const pkg = buildTrendPackage({
      now: new Date("2026-01-15T12:00:00Z"),
      random: () => 0,
      bareProducts: [
        {
          barcode: "111",
          brand: "Siete",
          productName: "Sea Salt Grain Free Tortilla Chips",
          category: "Snacks",
          score: 95,
          label: "Excellent",
          imageUrl: "https://example.com/siete.png",
          source: "manual",
          summary: ""
        },
        {
          barcode: "222",
          brand: "Boulder Canyon",
          productName: "Olive Oil Kettle Cooked Potato Chips",
          category: "Snacks",
          score: 92,
          label: "Excellent",
          imageUrl: "https://example.com/boulder.png",
          source: "manual",
          summary: ""
        },
        {
          barcode: "333",
          brand: "Primal Kitchen",
          productName: "Organic Unsweetened Ketchup",
          category: "Pantry",
          score: 90,
          label: "Excellent",
          imageUrl: "https://example.com/ketchup.png",
          source: "manual",
          summary: ""
        }
      ]
    });

    expect(pkg.title).toBe("Things I always buy at Trader Joe's");
    expect(pkg.carouselSlides?.[0].title).toBe("Things I always buy at Trader Joe's");
    expect(pkg.imagePrompts).toHaveLength(4);
    expect(pkg.carouselSlides?.map((slide) => slide.kind)).toEqual([
      "storefront-hook",
      "product-photo",
      "bare-screenshot",
      "product-photo",
      "bare-screenshot",
      "product-photo",
      "bare-screenshot"
    ]);
    expect(pkg.imagePrompts?.[0]).toContain("No overlay text");
    expect(pkg.imagePrompts?.[0]).not.toContain("Things I always buy at Trader Joe's");
    expect(pkg.slideText.join("\n")).not.toMatch(/\p{Emoji_Presentation}/u);
    expect(pkg.imagePrompts?.[1]).toContain('"Siete Sea Salt Grain Free Tortilla Chips"');
    expect(pkg.carouselSlides?.filter((slide) => slide.kind === "product-photo").every((slide) => /\s/.test(slide.productName ?? ""))).toBe(
      true
    );
  });

  test("does not invent product slides without BARE catalog products", () => {
    const pkg = buildTrendPackage({ now: new Date("2026-01-15T12:00:00Z"), random: () => 0 });

    expect(pkg.carouselSlides?.map((slide) => slide.kind)).toEqual(["storefront-hook"]);
    expect(pkg.imagePrompts).toHaveLength(1);
    expect(pkg.slideText).toEqual(["Things I always buy at Trader Joe's"]);
    expect(pkg.postingNotes.join("\n")).not.toContain("storefront");
    expect(pkg.postingNotes.join("\n")).not.toContain("hook");
  });

  test("can create benefit hooks without a named store", () => {
    const values = [0.6, 0, 0, 0, 0, 0, 0];
    const pkg = buildTrendPackage({
      now: new Date("2026-06-10T12:00:00Z"),
      random: () => values.shift() ?? 0
    });

    expect(pkg.title).toBe("Snacks with no artificial dyes");
    expect(pkg.carouselSlides?.[0].storeName).toBeUndefined();
    expect(pkg.imagePrompts?.[0]).toContain("no specific store branding");
  });

  test("attaches generated images only to generated-photo slides", () => {
    const pkg = attachGeneratedImagesToSlides(
      buildTrendPackage({
        now: new Date("2026-01-15T12:00:00Z"),
        random: () => 0,
        bareProducts: [
          {
            barcode: "111",
            brand: "Siete",
            productName: "Sea Salt Grain Free Tortilla Chips",
            category: "Snacks",
            score: 95,
            label: "Excellent",
            imageUrl: "https://example.com/siete.png",
            source: "manual",
            summary: ""
          },
          {
            barcode: "222",
            brand: "Boulder Canyon",
            productName: "Olive Oil Kettle Cooked Potato Chips",
            category: "Snacks",
            score: 92,
            label: "Excellent",
            imageUrl: "https://example.com/boulder.png",
            source: "manual",
            summary: ""
          },
          {
            barcode: "333",
            brand: "Primal Kitchen",
            productName: "Organic Unsweetened Ketchup",
            category: "Pantry",
            score: 90,
            label: "Excellent",
            imageUrl: "https://example.com/ketchup.png",
            source: "manual",
            summary: ""
          }
        ]
      }),
      ["generated/slide-01.png", "generated/slide-02.png", "generated/slide-03.png", "generated/slide-04.png"]
    );

    expect(pkg.carouselSlides?.map((slide) => slide.generatedImage ?? null)).toEqual([
      "generated/slide-01.png",
      "generated/slide-02.png",
      null,
      "generated/slide-03.png",
      null,
      "generated/slide-04.png",
      null
    ]);
  });
});
