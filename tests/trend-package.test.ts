import { describe, expect, test } from "vitest";
import { attachGeneratedImagesToSlides, buildTrendPackage } from "@/lib/generator/trend-package";

describe("buildTrendPackage", () => {
  test("creates the storefront, product, and BARE screenshot cadence", () => {
    const pkg = buildTrendPackage();

    expect(pkg.title).toBe("Non-toxic Trader Joe's snacks");
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
    expect(pkg.imagePrompts?.[0]).toContain('says exactly: "NON-TOXIC Trader Joe\'s snacks');
    expect(pkg.imagePrompts?.[1]).toContain('"Kettle Cooked Olive Oil Potato Chips"');
  });

  test("attaches generated images only to generated-photo slides", () => {
    const pkg = attachGeneratedImagesToSlides(buildTrendPackage(), [
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
