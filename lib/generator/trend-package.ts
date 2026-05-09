import type { CarouselSlidePlan, GeneratedPackage } from "@/lib/types";

type RandomFn = () => number;

type BuildTrendPackageOptions = {
  now?: Date;
  random?: RandomFn;
};

type Product = {
  brand: string;
  name: string;
  shortName: string;
  searchName: string;
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
};

type TimingHook = HookFamily & {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  occasion: string;
};

const STORES = ["Trader Joe's", "Sprouts", "Kroger", "Publix", "H-E-B", "Jewel-Osco"];

const PRODUCTS: Product[] = [
  {
    brand: "Siete",
    name: "Sea Salt Grain Free Tortilla Chips",
    shortName: "Siete Sea Salt Tortilla Chips",
    searchName: "Siete Sea Salt Grain Free Tortilla Chips product package"
  },
  {
    brand: "Boulder Canyon",
    name: "Olive Oil Kettle Cooked Potato Chips",
    shortName: "Boulder Canyon Olive Oil Chips",
    searchName: "Boulder Canyon Olive Oil Kettle Cooked Potato Chips product package"
  },
  {
    brand: "Primal Kitchen",
    name: "Organic Unsweetened Ketchup",
    shortName: "Primal Kitchen Ketchup",
    searchName: "Primal Kitchen Organic Unsweetened Ketchup product package"
  },
  {
    brand: "Spindrift",
    name: "Sparkling Water Lemon",
    shortName: "Spindrift Lemon Sparkling Water",
    searchName: "Spindrift Lemon Sparkling Water product package"
  },
  {
    brand: "Chomps",
    name: "Original Beef Stick",
    shortName: "Chomps Original Beef Stick",
    searchName: "Chomps Original Beef Stick product package"
  },
  {
    brand: "That's it.",
    name: "Apple + Strawberry Fruit Bar",
    shortName: "That's it. Apple Strawberry Bar",
    searchName: "That's it Apple Strawberry Fruit Bar product package"
  },
  {
    brand: "LesserEvil",
    name: "Himalayan Pink Salt Popcorn",
    shortName: "LesserEvil Pink Salt Popcorn",
    searchName: "LesserEvil Himalayan Pink Salt Popcorn product package"
  },
  {
    brand: "Simple Mills",
    name: "Almond Flour Crackers Fine Ground Sea Salt",
    shortName: "Simple Mills Sea Salt Crackers",
    searchName: "Simple Mills Almond Flour Crackers Fine Ground Sea Salt product package"
  }
];

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
    preferredScenes: ["Storefront", "Cart down aisle", "Full shopping cart"]
  },
  {
    title: "new-finds",
    hookText: (store) => `New finds at ${store}`,
    captionAngle: "new grocery finds worth checking before the next trip",
    preferredScenes: ["Storefront", "Shelf wall", "Full shopping cart"]
  },
  {
    title: "would-grab",
    hookText: (store) => `What I would grab at ${store} this week`,
    captionAngle: "a weekly grocery run shortlist",
    preferredScenes: ["Storefront", "Cart down aisle", "Full shopping cart"]
  }
];

const BENEFIT_HOOKS: HookFamily[] = [
  {
    title: "no-dyes",
    hookText: () => "Snacks with no artificial dyes",
    captionAngle: "dye-free snack options",
    preferredScenes: ["Random grocery aisle", "Shelf wall", "Full shopping cart"]
  },
  {
    title: "no-weird-additives",
    hookText: () => "Finds with no weird additives",
    captionAngle: "simple-label grocery finds",
    preferredScenes: ["Random grocery aisle", "Shelf wall", "Cart down aisle"]
  },
  {
    title: "skin",
    hookText: () => "Cleaner snacks for better skin",
    captionAngle: "cleaner snack swaps tied to skin-conscious routines",
    preferredScenes: ["Random grocery aisle", "Hand holding product", "Full shopping cart"]
  },
  {
    title: "protein",
    hookText: () => "High-protein snacks with simple ingredients",
    captionAngle: "protein-forward snacks with simple ingredients",
    preferredScenes: ["Shelf wall", "Random grocery aisle", "Full shopping cart"]
  },
  {
    title: "anti-inflammatory",
    hookText: () => "Anti-inflammatory grocery finds",
    captionAngle: "grocery finds that fit an anti-inflammatory shopping angle",
    preferredScenes: ["Random grocery aisle", "Cart down aisle", "Shelf wall"]
  },
  {
    title: "sweet-treats",
    hookText: () => "Sweet treats with better ingredients",
    captionAngle: "better-ingredient sweet treats",
    preferredScenes: ["Shelf wall", "Seasonal display", "Full shopping cart"]
  },
  {
    title: "toddler",
    hookText: () => "Toddler snacks with cleaner labels",
    captionAngle: "cleaner-label toddler snacks",
    preferredScenes: ["Kid in cart", "Random grocery aisle", "Full shopping cart"]
  },
  {
    title: "pantry-swaps",
    hookText: () => "Pantry swaps with simple ingredients",
    captionAngle: "simple-ingredient pantry swaps",
    preferredScenes: ["Shelf wall", "Random grocery aisle", "Full shopping cart"]
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
    preferredScenes: ["Full shopping cart", "Seasonal display", "Random grocery aisle"]
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
    preferredScenes: ["Seasonal display", "Shelf wall", "Full shopping cart"]
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
    preferredScenes: ["Seasonal display", "Full shopping cart", "Shelf wall"]
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
    preferredScenes: ["Full shopping cart", "Seasonal display", "Cart down aisle"]
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
    preferredScenes: ["Kid in cart", "Full shopping cart", "Random grocery aisle"]
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
    preferredScenes: ["Full shopping cart", "Seasonal display", "Random grocery aisle"]
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
    preferredScenes: ["Full shopping cart", "Seasonal display", "Cart down aisle"]
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
    preferredScenes: ["Seasonal display", "Full shopping cart", "Shelf wall"]
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
    preferredScenes: ["Seasonal display", "Full shopping cart", "Shelf wall"]
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
    preferredScenes: ["Full shopping cart", "Random grocery aisle", "Cart down aisle"]
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

function buildHeroPrompt(hookText: string, scene: HeroScene, storeName: string | undefined): string {
  const sceneDescription = scene.description.replaceAll("{store}", storeName ?? "a grocery");

  return `Photorealistic vertical smartphone photo ${sceneDescription}, natural grocery-store lighting, casual TikTok slideshow aesthetic. Add a white rounded text sticker near the top that says exactly: "${hookText}". No emojis in the text. Make it look like a real phone photo, not a designed graphic.`;
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

function selectProducts(random: RandomFn): Product[] {
  const remaining = [...PRODUCTS];
  const selected: Product[] = [];

  while (selected.length < 3 && remaining.length) {
    const product = pick(remaining, random);
    selected.push(product);
    remaining.splice(remaining.indexOf(product), 1);
  }

  return selected;
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

export function buildTrendPackage({ now = new Date(), random = Math.random }: BuildTrendPackageOptions = {}): GeneratedPackage {
  const { hook, occasion } = selectHook(now, random);
  const scene = pickHeroScene(hook, random);
  const storeName = scene.storeRequired || STORE_HOOKS.includes(hook) ? pick(STORES, random) : undefined;
  const hookText = hook.hookText(storeName, occasion);
  const products = selectProducts(random);
  const carouselSlides: CarouselSlidePlan[] = [
    {
      position: 1,
      kind: "storefront-hook",
      title: `${scene.title} hook`,
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
      prompt: productPrompt(product, storeName)
    });
    carouselSlides.push({
      position: carouselSlides.length + 1,
      kind: "bare-screenshot",
      title: `BARE app screenshot for ${product.shortName}`,
      productName: productDisplayName(product)
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
      `Use the generated ${scene.title.toLowerCase()} image first.`,
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
