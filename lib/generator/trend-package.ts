import type { CarouselSlidePlan, GeneratedPackage } from "@/lib/types";

const STORE_NAME = "Trader Joe's";
const HOOK_TEXT = "NON-TOXIC Trader Joe's snacks";

const PRODUCTS = [
  {
    name: "Kettle Cooked Olive Oil Potato Chips",
    shortName: "Olive Oil Potato Chips"
  },
  {
    name: "Unexpected Cheddar Cheese Snackers",
    shortName: "Unexpected Cheddar Cheese Snackers"
  },
  {
    name: "Salsa Taquera",
    shortName: "Salsa Taquera"
  }
];

function storefrontPrompt(): string {
  return `Photorealistic vertical smartphone photo outside a Trader Joe's grocery store, shot from a low angle looking up at the storefront sign and sky, natural daylight, authentic TikTok slideshow style. Add a white rounded text sticker near the top that says exactly: "${HOOK_TEXT}". Do not include emojis. Make it look like a real phone photo, not a designed graphic.`;
}

function productPrompt(productName: string): string {
  return `Photorealistic vertical smartphone photo inside Trader Joe's. A real human hand is holding the exact product "${productName}" in the foreground, label facing camera, product name spelled correctly and readable. Grocery shelf background with similar items, natural store lighting, casual TikTok slideshow aesthetic, no overlay text, no graphic design, no fake UI. The image should look like someone actually picked up this Trader Joe's item in-store.`;
}

export function buildTrendPackage(): GeneratedPackage {
  const carouselSlides: CarouselSlidePlan[] = [
    {
      position: 1,
      kind: "storefront-hook",
      title: "Storefront hook",
      storeName: STORE_NAME,
      prompt: storefrontPrompt()
    }
  ];

  for (const product of PRODUCTS) {
    carouselSlides.push({
      position: carouselSlides.length + 1,
      kind: "product-photo",
      title: product.shortName,
      storeName: STORE_NAME,
      productName: product.name,
      prompt: productPrompt(product.name)
    });
    carouselSlides.push({
      position: carouselSlides.length + 1,
      kind: "bare-screenshot",
      title: `BARE app screenshot for ${product.shortName}`,
      productName: product.name
    });
  }

  const imagePrompts = carouselSlides.flatMap((slide) => (slide.prompt ? [slide.prompt] : []));

  return {
    title: "Non-toxic Trader Joe's snacks",
    mainCaption:
      "A few cleaner Trader Joe's snack finds to look for next time you're shopping. Save this before your next grocery run.",
    alternateHooks: [
      "Non-toxic Trader Joe's snacks worth grabbing",
      "Cleaner Trader Joe's snacks I would actually buy",
      "Trader Joe's finds with simple ingredients"
    ],
    hashtags: ["#traderjoesfinds", "#nontoxicliving", "#healthysnacks", "#groceryhaul"],
    slideText: carouselSlides.map((slide) => {
      if (slide.kind === "storefront-hook") {
        return HOOK_TEXT;
      }
      if (slide.kind === "product-photo") {
        return `Product photo: ${slide.productName}`;
      }
      return `Insert BARE app screenshot: ${slide.productName}`;
    }),
    postingNotes: [
      "Use the generated storefront image first.",
      "After every product photo, insert your matching BARE app screenshot.",
      "Check product label spelling before posting."
    ],
    imagePrompts,
    generatedImages: [],
    carouselSlides
  };
}

export function attachGeneratedImagesToSlides(pkg: GeneratedPackage, generatedImages: string[]): GeneratedPackage {
  let imageIndex = 0;
  const carouselSlides = (pkg.carouselSlides ?? []).map((slide) => {
    if (slide.kind === "bare-screenshot") {
      return slide;
    }

    const generatedImage = generatedImages[imageIndex];
    imageIndex += 1;
    return {
      ...slide,
      generatedImage
    };
  });

  return {
    ...pkg,
    generatedImages,
    carouselSlides
  };
}
