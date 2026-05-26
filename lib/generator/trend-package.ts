import type { CarouselSlidePlan, GeneratedPackage, StrategyFormat } from "@/lib/types";
import type { BareProduct } from "@/lib/products/bare-catalog";

type RandomFn = () => number;

type BuildTrendPackageOptions = {
  now?: Date;
  random?: RandomFn;
  bareProducts?: BareProduct[];
  forceStorefrontHero?: boolean;
  storeName?: string;
};

type Product = {
  brand: string;
  name: string;
  shortName: string;
  searchName: string;
  barcode?: string;
  imageUrl?: string;
  score?: number | null;
  label?: string;
  summary?: string;
};

type HeroScene = {
  title: string;
  description: string;
  storeRequired: boolean;
};

type HookFamily = {
  title: string;
  hookText: (store?: string, occasion?: string) => string;
  captionAngle: string;
  preferredScenes: string[];
  strategy: StrategyFormat;
};

type TimingHook = HookFamily & {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  occasion: string;
};

const STORES = ["Trader Joe's", "Sprouts", "Kroger", "Publix", "H-E-B", "Jewel-Osco"];

const STRATEGY_FORMATS = {
  storeWeeklyFinds: {
    id: "store-weekly-finds",
    name: "Store-specific weekly finds",
    source: "Provided competitor grocery carousel screenshots plus TikTok performance research.",
    outlierSignal:
      "A simple store hook creates immediate context, then the carousel delivers concrete product proof instead of broad wellness advice.",
    formatPattern: "Store or cart hero with large native overlay -> branded product photo -> BARE scanner proof, repeated for 3 products.",
    conversionIntent:
      "Turn grocery curiosity into a reason to use BARE before or during the next shopping trip.",
    reusableVariables: ["store", "week/timing", "product category", "clean-label benefit"]
  },
  benefitAisleFinds: {
    id: "benefit-aisle-finds",
    name: "Benefit-led aisle finds",
    source: "Provided competitor grocery carousel screenshots plus TikTok performance research.",
    outlierSignal:
      "The visual is ordinary grocery context, but the hook is a specific shopper problem people already search and save.",
    formatPattern: "Aisle/cart hero with benefit hook -> branded product photo -> BARE scanner proof, repeated for 3 products.",
    conversionIntent:
      "Capture high-intent shoppers who care about ingredients, then show BARE as the verification step.",
    reusableVariables: ["ingredient concern", "health benefit", "shopper persona", "product category"]
  },
  seasonalSwaps: {
    id: "seasonal-swaps",
    name: "Seasonal swap list",
    source: "Provided strategy notes on timing hooks plus TikTok performance research.",
    outlierSignal:
      "Timing gives the post current relevance; product proof keeps it useful instead of generic holiday content.",
    formatPattern: "Seasonal grocery hero -> branded product photo -> BARE scanner proof, repeated for 3 products.",
    conversionIntent:
      "Create a near-term reason to save, share, scan, and post before the occasion passes.",
    reusableVariables: ["occasion", "party context", "dietary need", "store"]
  }
} satisfies Record<string, StrategyFormat>;

const HERO_SCENES: HeroScene[] = [
  {
    title: "Storefront",
    description: "outside a recognizable {store} grocery store, low angle, storefront sign visible",
    storeRequired: true
  },
  {
    title: "Random grocery aisle",
    description: "in a busy grocery snack aisle with shelves on both sides, no specific store branding",
    storeRequired: false
  },
  {
    title: "Cart down aisle",
    description: "pushing a grocery cart down a bright aisle, casual shopper POV, no specific store branding",
    storeRequired: false
  },
  {
    title: "Kid in cart",
    description: "pushing a kid seated in a grocery cart through an aisle, family shopping POV, no specific store branding",
    storeRequired: false
  },
  {
    title: "Full shopping cart",
    description: "top-down photo of a full grocery cart with cleaner packaged snacks and pantry finds",
    storeRequired: false
  },
  {
    title: "Shelf wall",
    description: "straight-on grocery shelf wall full of packaged snacks and pantry items",
    storeRequired: false
  },
  {
    title: "Hand holding product",
    description: "a hand holding a grocery product in front of a stocked aisle, product-forward shopper POV",
    storeRequired: false
  },
  {
    title: "Seasonal display",
    description: "seasonal grocery display with party snacks, treats, and limited-time products",
    storeRequired: false
  }
];

const STORE_HOOKS: HookFamily[] = [
  {
    title: "always-buy",
    hookText: (store) => `Things I always buy at ${store}`,
    captionAngle: "store-specific cleaner grocery finds",
    preferredScenes: ["Storefront", "Cart down aisle", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.storeWeeklyFinds
  },
  {
    title: "new-finds",
    hookText: (store) => `New finds at ${store}`,
    captionAngle: "new grocery finds worth checking before the next trip",
    preferredScenes: ["Storefront", "Shelf wall", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.storeWeeklyFinds
  },
  {
    title: "would-grab",
    hookText: (store) => `What I would grab at ${store} this week`,
    captionAngle: "a weekly grocery run shortlist",
    preferredScenes: ["Storefront", "Cart down aisle", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.storeWeeklyFinds
  }
];

const BENEFIT_HOOKS: HookFamily[] = [
  {
    title: "no-dyes",
    hookText: () => "Snacks with no artificial dyes",
    captionAngle: "dye-free snack options",
    preferredScenes: ["Random grocery aisle", "Shelf wall", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.benefitAisleFinds
  },
  {
    title: "no-weird-additives",
    hookText: () => "Finds with no weird additives",
    captionAngle: "simple-label grocery finds",
    preferredScenes: ["Random grocery aisle", "Shelf wall", "Cart down aisle"],
    strategy: STRATEGY_FORMATS.benefitAisleFinds
  },
  {
    title: "skin",
    hookText: () => "Cleaner snacks for better skin",
    captionAngle: "cleaner snack swaps tied to skin-conscious routines",
    preferredScenes: ["Random grocery aisle", "Hand holding product", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.benefitAisleFinds
  },
  {
    title: "protein",
    hookText: () => "High-protein snacks with simple ingredients",
    captionAngle: "protein-forward snacks with simple ingredients",
    preferredScenes: ["Shelf wall", "Random grocery aisle", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.benefitAisleFinds
  },
  {
    title: "anti-inflammatory",
    hookText: () => "Anti-inflammatory grocery finds",
    captionAngle: "grocery finds that fit an anti-inflammatory shopping angle",
    preferredScenes: ["Random grocery aisle", "Cart down aisle", "Shelf wall"],
    strategy: STRATEGY_FORMATS.benefitAisleFinds
  },
  {
    title: "sweet-treats",
    hookText: () => "Sweet treats with better ingredients",
    captionAngle: "better-ingredient sweet treats",
    preferredScenes: ["Shelf wall", "Seasonal display", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.benefitAisleFinds
  },
  {
    title: "toddler",
    hookText: () => "Toddler snacks with cleaner labels",
    captionAngle: "cleaner-label toddler snacks",
    preferredScenes: ["Kid in cart", "Random grocery aisle", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.benefitAisleFinds
  },
  {
    title: "pantry-swaps",
    hookText: () => "Pantry swaps with simple ingredients",
    captionAngle: "simple-ingredient pantry swaps",
    preferredScenes: ["Shelf wall", "Random grocery aisle", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.benefitAisleFinds
  }
];

const TIMING_HOOKS: TimingHook[] = [
  {
    title: "super-bowl",
    occasion: "Super Bowl",
    startMonth: 1,
    startDay: 10,
    endMonth: 2,
    endDay: 15,
    hookText: () => "Better Super Bowl snacks",
    captionAngle: "cleaner party snacks for game day",
    preferredScenes: ["Full shopping cart", "Seasonal display", "Random grocery aisle"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "valentines",
    occasion: "Valentine's Day",
    startMonth: 1,
    startDay: 20,
    endMonth: 2,
    endDay: 15,
    hookText: () => "Valentine's sweet treats with better ingredients",
    captionAngle: "better-ingredient Valentine's treats",
    preferredScenes: ["Seasonal display", "Shelf wall", "Full shopping cart"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "easter",
    occasion: "Easter",
    startMonth: 3,
    startDay: 1,
    endMonth: 4,
    endDay: 20,
    hookText: () => "Cleaner Easter basket finds",
    captionAngle: "cleaner seasonal treats and basket ideas",
    preferredScenes: ["Seasonal display", "Full shopping cart", "Shelf wall"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "memorial-day",
    occasion: "Memorial Day",
    startMonth: 5,
    startDay: 1,
    endMonth: 5,
    endDay: 31,
    hookText: () => "Better Memorial Day cookout swaps",
    captionAngle: "cleaner cookout and party swaps",
    preferredScenes: ["Full shopping cart", "Seasonal display", "Cart down aisle"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "back-to-school",
    occasion: "back to school",
    startMonth: 7,
    startDay: 15,
    endMonth: 9,
    endDay: 10,
    hookText: () => "Back-to-school snacks with cleaner labels",
    captionAngle: "cleaner lunchbox and after-school snacks",
    preferredScenes: ["Kid in cart", "Full shopping cart", "Random grocery aisle"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "football",
    occasion: "football season",
    startMonth: 8,
    startDay: 15,
    endMonth: 11,
    endDay: 30,
    hookText: () => "Better football snack finds",
    captionAngle: "cleaner snacks for football weekends",
    preferredScenes: ["Full shopping cart", "Seasonal display", "Random grocery aisle"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "labor-day",
    occasion: "Labor Day",
    startMonth: 8,
    startDay: 15,
    endMonth: 9,
    endDay: 10,
    hookText: () => "Better Labor Day snack swaps",
    captionAngle: "cleaner long-weekend snacks and cookout swaps",
    preferredScenes: ["Full shopping cart", "Seasonal display", "Cart down aisle"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "halloween",
    occasion: "Halloween",
    startMonth: 9,
    startDay: 15,
    endMonth: 10,
    endDay: 31,
    hookText: () => "Halloween treats with better ingredients",
    captionAngle: "better-ingredient Halloween treats",
    preferredScenes: ["Seasonal display", "Full shopping cart", "Shelf wall"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "christmas",
    occasion: "Christmas",
    startMonth: 11,
    startDay: 15,
    endMonth: 12,
    endDay: 26,
    hookText: () => "Holiday snacks with cleaner labels",
    captionAngle: "cleaner holiday snacks and treats",
    preferredScenes: ["Seasonal display", "Full shopping cart", "Shelf wall"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  },
  {
    title: "new-years",
    occasion: "New Year's",
    startMonth: 12,
    startDay: 20,
    endMonth: 1,
    endDay: 10,
    hookText: () => "Cleaner grocery finds for a reset",
    captionAngle: "simple-ingredient reset grocery finds",
    preferredScenes: ["Full shopping cart", "Random grocery aisle", "Cart down aisle"],
    strategy: STRATEGY_FORMATS.seasonalSwaps
  }
];

function pick<T>(items: T[], random: RandomFn): T {
  return items[Math.floor(random() * items.length) % items.length];
}

function isDateInRange(now: Date, startMonth: number, startDay: number, endMonth: number, endDay: number): boolean {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const value = month * 100 + day;
  const start = startMonth * 100 + startDay;
  const end = endMonth * 100 + endDay;

  if (start <= end) {
    return value >= start && value <= end;
  }

  return value >= start || value <= end;
}

function eligibleTimingHooks(now: Date) {
  return TIMING_HOOKS.filter((hook) => isDateInRange(now, hook.startMonth, hook.startDay, hook.endMonth, hook.endDay));
}

function pickHeroScene(hook: HookFamily, random: RandomFn): HeroScene {
  const preferred = HERO_SCENES.filter((scene) => hook.preferredScenes.includes(scene.title));
  return pick(preferred.length ? preferred : HERO_SCENES, random);
}

function storefrontScene(): HeroScene {
  return HERO_SCENES.find((scene) => scene.title === "Storefront") ?? HERO_SCENES[0];
}

function buildHeroPrompt(hookText: string, scene: HeroScene, storeName: string | undefined): string {
  const sceneDescription = scene.description.replaceAll("{store}", storeName ?? "a grocery");

  return `Photorealistic vertical smartphone photo ${sceneDescription}, natural grocery-store lighting, casual TikTok slideshow aesthetic. Leave clean negative space in the center for app-added text. No overlay text, no captions, no words, no graphic design. Do not show raw meat, raw chicken, raw poultry, uncooked fish, butcher cases, meat trays, or bloody/uncooked food.`;
}

function productDisplayName(product: Product): string {
  return `${product.brand} ${product.name}`;
}

function productPrompt(product: Product, storeName: string | undefined): string {
  const storeContext = storeName ? `inside ${storeName}` : "inside a grocery store";
  return `Photorealistic vertical smartphone photo ${storeContext}. A real human hand is holding the exact branded packaged product "${productDisplayName(product)}" in the foreground, label facing camera, brand and product name spelled correctly and readable, barcode present somewhere on the package if visible. Grocery shelf background with similar items, natural store lighting, casual TikTok slideshow aesthetic, no overlay text, no graphic design, no fake UI.`;
}

function sentenceCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function productFromBare(product: BareProduct): Product {
  return {
    brand: product.brand,
    name: product.productName,
    shortName: `${product.brand} ${product.productName}`,
    searchName: `${product.brand} ${product.productName} product package barcode`,
    barcode: product.barcode,
    imageUrl: product.imageUrl,
    score: product.score,
    label: product.label,
    summary: product.summary
  };
}

function selectHook(now: Date, random: RandomFn): { hook: HookFamily; occasion?: string } {
  const timing = eligibleTimingHooks(now);
  const families = timing.length ? [STORE_HOOKS, BENEFIT_HOOKS, timing] : [STORE_HOOKS, BENEFIT_HOOKS, BENEFIT_HOOKS];
  const family = pick(families, random);
  const hook = pick(family, random);
  return {
    hook,
    occasion: isTimingHook(hook) ? hook.occasion : undefined
  };
}

function isTimingHook(hook: HookFamily): hook is TimingHook {
  return "occasion" in hook && typeof hook.occasion === "string";
}

export function buildTrendPackage({
  now = new Date(),
  random = Math.random,
  bareProducts,
  forceStorefrontHero = false,
  storeName: forcedStoreName
}: BuildTrendPackageOptions = {}): GeneratedPackage {
  const selected = forceStorefrontHero ? { hook: pick(STORE_HOOKS, random), occasion: undefined } : selectHook(now, random);
  const { hook, occasion } = selected;
  const scene = forceStorefrontHero ? storefrontScene() : pickHeroScene(hook, random);
  const storeName = forcedStoreName ?? (scene.storeRequired || STORE_HOOKS.includes(hook) ? pick(STORES, random) : undefined);
  const hookText = hook.hookText(storeName, occasion);
  const products = bareProducts?.slice(0, 3).map(productFromBare) ?? [];
  const carouselSlides: CarouselSlidePlan[] = [
    {
      position: 1,
      kind: "storefront-hook",
      title: hookText,
      storeName,
      prompt: buildHeroPrompt(hookText, scene, storeName)
    }
  ];

  for (const product of products) {
    carouselSlides.push({
      position: carouselSlides.length + 1,
      kind: "product-photo",
      title: product.shortName,
      storeName,
      productName: productDisplayName(product),
      barcode: product.barcode,
      bareImageUrl: product.imageUrl,
      bareScore: product.score,
      bareLabel: product.label,
      bareSummary: product.summary,
      prompt: productPrompt(product, storeName)
    });
    carouselSlides.push({
      position: carouselSlides.length + 1,
      kind: "bare-screenshot",
      title: `BARE app screenshot for ${product.shortName}`,
      productName: productDisplayName(product),
      barcode: product.barcode,
      bareImageUrl: product.imageUrl,
      bareScore: product.score,
      bareLabel: product.label,
      bareSummary: product.summary
    });
  }

  const imagePrompts = carouselSlides.flatMap((slide) => (slide.prompt ? [slide.prompt] : []));
  const storePhrase = storeName ? ` at ${storeName}` : "";

  return {
    title: hookText,
    mainCaption: `${sentenceCase(hook.captionAngle)}${storePhrase}. Save this so you can compare labels before your next grocery run.`,
    alternateHooks: [
      hookText,
      storeName ? `What I found at ${storeName}` : "What I found in the grocery aisle",
      occasion ? `${occasion} grocery finds worth checking` : "Cleaner grocery finds worth checking"
    ],
    hashtags: ["#groceryfinds", "#cleaningredients", "#healthysnacks", "#betteringredients"],
    slideText: carouselSlides.map((slide) => {
      if (slide.kind === "storefront-hook") {
        return hookText;
      }
      if (slide.kind === "product-photo") {
        return `Product photo: ${slide.productName}`;
      }
      return `Insert BARE app screenshot: ${slide.productName}`;
    }),
    postingNotes: [
      `Format: ${hook.strategy.name}.`,
      "Use the generated hero image first.",
      "After every product photo, insert your matching BARE app screenshot.",
      "Check product label spelling before posting."
    ],
    strategy: hook.strategy,
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
