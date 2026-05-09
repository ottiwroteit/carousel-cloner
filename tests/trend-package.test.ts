import { describe, expect, test } from "vitest";
import { attachGeneratedImagesToSlides, buildTrendPackage } from "@/lib/generator/trend-package";

describe("buildTrendPackage", () => {
  test("creates a randomized hero, product, and BARE screenshot cadence", () => {
    const pkg = buildTrendPackage({ now: new Date("2026-01-15T12:00:00Z"), random: () => 0 });

    expect(pkg.title).toBe("Things I always buy at Trader Joe's");
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
    expect(pkg.imagePrompts?.[0]).toContain('says exactly: "Things I always buy at Trader Joe\'s"');
    expect(pkg.imagePrompts?.[0]).toContain("No emojis in the text");
    expect(pkg.slideText.join("\n")).not.toMatch(/\p{Emoji_Presentation}/u);
    expect(pkg.imagePrompts?.[1]).toContain('"Siete Sea Salt Grain Free Tortilla Chips"');
    expect(pkg.carouselSlides?.filter((slide) => slide.kind === "product-photo").every((slide) => /\s/.test(slide.productName ?? ""))).toBe(
      true
    );
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
    const pkg = attachGeneratedImagesToSlides(buildTrendPackage({ now: new Date("2026-01-15T12:00:00Z"), random: () => 0 }), [
      "generated/slide-01.png",
      "generated/slide-02.png",
      "generated/slide-03.png",
      "generated/slide-04.png"
    ]);

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
