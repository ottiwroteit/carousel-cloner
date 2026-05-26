import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatCaptionPackage } from "@/lib/export/captions";
import { extractTikTokSource, type ExtractTikTokSourceResult } from "@/lib/extractors/tiktok";
import { completeCarouselImages } from "@/lib/generator/complete-carousel-images";
import { composeHeroImage, composeLocalHeroImage } from "@/lib/generator/compose-hero-image";
import { composeProductImage } from "@/lib/generator/compose-product-image";
import { generateOpenAIImages, getOpenAIImageConfig } from "@/lib/generator/openai-images";
import { generateSlideImages } from "@/lib/generator/slides";
import { attachGeneratedImagesToSlides, buildTrendPackage } from "@/lib/generator/trend-package";
import { findWebProductImage, type WebProductImage } from "@/lib/generator/web-product-images";
import {
  DEFAULT_JOBS_ROOT,
  readJob,
  updateJobStatus,
  writeJobArtifact,
  writeJobTextArtifact,
  type JobSnapshot
} from "@/lib/jobs/store";
import { readBareCatalog, selectBareProducts } from "@/lib/products/bare-catalog";
import { fetchWithCurlFallback } from "@/lib/http";
import type { SourceAnalysis } from "@/lib/types";

type ProcessJobOptions = {
  root?: string;
  extract?: (url: string, jobDir: string) => Promise<ExtractTikTokSourceResult>;
  hasOpenAIKey?: boolean;
  useOpenAIImages?: boolean;
  forceStorefrontHero?: boolean;
  storeName?: string;
  useStockHeroImages?: boolean;
  useBareSimulatorScreenshots?: boolean;
  requireBareSimulatorScreenshots?: boolean;
  generateOpenAIImages?: typeof generateOpenAIImages;
  findWebProductImage?: typeof findWebProductImage;
  readBareCatalog?: typeof readBareCatalog;
};

type ImageGenerationArtifact =
  | { provider: "openai"; model: string; quality: string; outputFormat: string }
  | { provider: "hybrid-web-openai"; model: string; quality: string; outputFormat: string; productSources: WebProductImage[] }
  | { provider: "local-real-products"; reason: string; productSources: WebProductImage[] }
  | { provider: "local-svg"; reason: string };

const STOCK_HERO_IMAGES = [
  "https://images.pexels.com/photos/30869949/pexels-photo-30869949.jpeg?cs=srgb&fm=jpg"
];

async function downloadStockHeroImage(jobDir: string, index: number): Promise<string> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });
  const sourceUrl = STOCK_HERO_IMAGES[index % STOCK_HERO_IMAGES.length];
  const response = await fetchWithCurlFallback(sourceUrl);
  if (!response.ok) {
    throw new Error(`Stock hero image failed with HTTP ${response.status}.`);
  }

  const relativePath = path.join("generated", `hero-source-${String(index + 1).padStart(2, "0")}.jpg`);
  await writeFile(path.join(jobDir, relativePath), Buffer.from(await response.arrayBuffer()));
  return relativePath;
}

function buildFallbackAnalysis(reason: string): SourceAnalysis {
  return {
    summary: "Direct extraction did not return source slides, so this job uses the grocery-store trend cadence.",
    hook: reason.includes("blocked") ? "Direct TikTok extraction was blocked" : reason,
    pacing: "Use the trend sequence: hero hook image, product-in-hand photo, BARE app screenshot, then repeat for each product.",
    visualPattern: "Hero scenes can be storefront, aisle, cart, shelf, seasonal display, or family shopping POV. Product slides have no overlay text.",
    captionStrategy: "Frame the post as cleaner grocery finds worth saving before the next store trip.",
    whyItWorks: "It matches a TikTok-native shopping format: recognizable store context, real product proof, then BARE app validation."
  };
}

async function generateLocalImagesWithRealProducts(
  snapshot: JobSnapshot,
  pkg: ReturnType<typeof buildTrendPackage>,
  findProductImage: typeof findWebProductImage,
  useStockHeroImages = false
): Promise<{ generatedImages: string[]; productSources: WebProductImage[] }> {
  const generatedDir = path.join(snapshot.dir, "generated");
  await mkdir(generatedDir, { recursive: true });

  const slides = (pkg.carouselSlides ?? []).filter((slide) => slide.kind !== "bare-screenshot");
  const generatedImages: string[] = [];
  const productSources: WebProductImage[] = [];

  for (const [index, slide] of slides.entries()) {
    const slideNumber = index + 1;

    if (slide.productName && slide.bareImageUrl) {
      const productImage = await findProductImage({
        jobDir: snapshot.dir,
        productName: slide.productName,
        imageUrl: slide.bareImageUrl,
        pageUrl: slide.barcode ? `bare://product/${slide.barcode}` : undefined,
        title: slide.productName,
        index
      });
      productSources.push(productImage);
      generatedImages.push(
        await composeProductImage({
          jobDir: snapshot.dir,
          sourceRelativePath: productImage.relativePath,
          outputName: `slide-${String(slideNumber).padStart(2, "0")}`,
          variant: slideNumber
        })
      );
      continue;
    }

    try {
      if (!useStockHeroImages) {
        throw new Error("Stock hero images disabled.");
      }
      const heroSource = await downloadStockHeroImage(snapshot.dir, slideNumber);
      generatedImages.push(
        await composeHeroImage({
          jobDir: snapshot.dir,
          sourceRelativePath: heroSource,
          outputName: `slide-${String(slideNumber).padStart(2, "0")}`,
          title: slide.title
        })
      );
    } catch {
      generatedImages.push(
        await composeLocalHeroImage({
          jobDir: snapshot.dir,
          outputName: `slide-${String(slideNumber).padStart(2, "0")}`,
          title: slide.title,
          storeName: slide.storeName,
          variant: slideNumber
        })
      );
    }
  }

  return { generatedImages, productSources };
}

export async function processJob(id: string, options: ProcessJobOptions = {}): Promise<JobSnapshot> {
  const root = options.root ?? DEFAULT_JOBS_ROOT;
  let snapshot = await readJob(id, root);

  await updateJobStatus(id, { state: "extracting", progress: 15, message: "Extracting TikTok source" }, root);

  const extract =
    options.extract ??
    ((url: string, jobDir: string) =>
      extractTikTokSource({
        url,
        jobDir,
        cookiesFile: process.env.TIKTOK_COOKIES_FILE
      }));
  const extraction = await extract(snapshot.input.url, snapshot.dir);

  await updateJobStatus(id, { state: "analyzing", progress: 45, message: "Analyzing source pattern" }, root);

  const analysis = extraction.ok
    ? {
        summary: `Read ${extraction.source.images.length} source image reference(s) from TikTok metadata.`,
        hook: "Source slideshow metadata was available for analysis",
        pacing: "Mirror the source sequence length while changing the creative angle.",
        visualPattern: extraction.source.warning ?? "Use the extracted image references as visual research only.",
        captionStrategy: "Rewrite the promise in the account voice.",
        whyItWorks: "The source has a proven format, and the output uses that structure without copying the asset."
      }
    : buildFallbackAnalysis(extraction.error.message);

  await writeJobArtifact(id, "analysis.json", analysis, root);
  if (extraction.ok) {
    await writeJobArtifact(id, "source.json", extraction.source, root);
  } else {
    await writeJobArtifact(id, "extractor-error.json", extraction.error, root);
  }

  await updateJobStatus(id, { state: "generating_copy", progress: 70, message: "Generating captions and slide text" }, root);

  const catalogReader = options.readBareCatalog ?? readBareCatalog;
  const catalogProducts = selectBareProducts(await catalogReader(), 3, Math.random, { storeName: options.storeName });
  if (catalogProducts.length === 0) {
    throw new Error("BARE catalog did not return any marketable products with images.");
  }
  await writeJobArtifact(
    id,
    "bare-product-selection.json",
    catalogProducts.map((product) => ({
      barcode: product.barcode,
      brand: product.brand,
      productName: product.productName,
      score: product.score,
      label: product.label,
      imageUrl: product.imageUrl
    })),
    root
  );

  let generated = buildTrendPackage({
    bareProducts: catalogProducts,
    forceStorefrontHero: options.forceStorefrontHero,
    storeName: options.storeName
  });
  const hasOpenAIKey = options.hasOpenAIKey ?? Boolean(process.env.OPENAI_API_KEY);
  const openAIImageGenerator = options.generateOpenAIImages ?? generateOpenAIImages;
  const webProductImageFinder = options.findWebProductImage ?? findWebProductImage;
  const imageConfig = getOpenAIImageConfig();
  const useOpenAIImages = options.useOpenAIImages ?? imageConfig.enabled;

  if (useOpenAIImages && hasOpenAIKey) {
    try {
      const generatedImages: string[] = [];
      const productSources: WebProductImage[] = [];
      const generatedSlides = (generated.carouselSlides ?? []).filter((slide) => slide.kind !== "bare-screenshot");
      const heroPrompts = generatedSlides.filter((slide) => !slide.productName).flatMap((slide) => (slide.prompt ? [slide.prompt] : []));
      const heroImages = heroPrompts.length
        ? await openAIImageGenerator({
            jobDir: snapshot.dir,
            prompts: heroPrompts,
            config: imageConfig
          })
        : [];
      let heroIndex = 0;

      for (const [index, slide] of generatedSlides.entries()) {
        if (slide.productName) {
          if (slide.bareImageUrl) {
            const productImage = await webProductImageFinder({
              jobDir: snapshot.dir,
              productName: slide.productName,
              imageUrl: slide.bareImageUrl,
              pageUrl: slide.barcode ? `bare://product/${slide.barcode}` : undefined,
              title: slide.productName,
              index
            });
            generatedImages.push(productImage.relativePath);
            productSources.push(productImage);
          } else {
            const productImage = await webProductImageFinder({
              jobDir: snapshot.dir,
              productName: slide.productName,
              index
            });
            generatedImages.push(productImage.relativePath);
            productSources.push(productImage);
          }
          continue;
        }

        generatedImages.push(heroImages[heroIndex]);
        heroIndex += 1;
      }

      generated = attachGeneratedImagesToSlides(generated, generatedImages);
      const artifact: ImageGenerationArtifact = productSources.length
        ? {
            provider: "hybrid-web-openai",
            model: imageConfig.model,
            quality: imageConfig.quality,
            outputFormat: "png",
            productSources
          }
        : {
            provider: "openai",
            model: imageConfig.model,
            quality: imageConfig.quality,
            outputFormat: "png"
          };
      await writeJobArtifact(id, "image-generation.json", artifact, root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const generatedImages = await generateSlideImages(snapshot.dir, generated, snapshot.input.profile);
      generated = attachGeneratedImagesToSlides(generated, generatedImages);
      await writeJobArtifact(
        id,
        "image-generation.json",
        {
          provider: "local-svg",
          reason: `OpenAI/web image generation failed: ${message}`
        },
        root
      );
    }
  } else {
    const productSlidesWithImages = (generated.carouselSlides ?? []).filter((slide) => slide.kind === "product-photo" && slide.bareImageUrl);
    if (productSlidesWithImages.length > 0) {
      try {
        const { generatedImages, productSources } = await generateLocalImagesWithRealProducts(
          snapshot,
          generated,
          webProductImageFinder,
          options.useStockHeroImages
        );
        generated = attachGeneratedImagesToSlides(generated, generatedImages);
        await writeJobArtifact(
          id,
          "image-generation.json",
          {
            provider: "local-real-products",
            reason: useOpenAIImages ? "OPENAI_API_KEY is not set; using BARE product images." : "Local mode is using BARE product images.",
            productSources
          },
          root
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const generatedImages = await generateSlideImages(snapshot.dir, generated, snapshot.input.profile);
        generated = attachGeneratedImagesToSlides(generated, generatedImages);
        await writeJobArtifact(
          id,
          "image-generation.json",
          {
            provider: "local-svg",
            reason: `Local BARE product images failed: ${message}`
          },
          root
        );
      }
    } else {
      const generatedImages = await generateSlideImages(snapshot.dir, generated, snapshot.input.profile);
      generated = attachGeneratedImagesToSlides(generated, generatedImages);
      await writeJobArtifact(
        id,
        "image-generation.json",
        {
          provider: "local-svg",
          reason: useOpenAIImages ? "OPENAI_API_KEY is not set." : "Local image mode is enabled."
        },
        root
      );
    }
  }

  generated = await completeCarouselImages({
    jobDir: snapshot.dir,
    pkg: generated,
    useBareSimulatorScreenshots: options.useBareSimulatorScreenshots,
    requireBareSimulatorScreenshots: options.requireBareSimulatorScreenshots
  });

  await writeJobArtifact(id, "package.json", generated, root);
  await writeJobTextArtifact(id, "captions.txt", formatCaptionPackage(generated), root);

  await updateJobStatus(id, { state: "ready", progress: 100, message: "Caption package is ready" }, root);
  snapshot = await readJob(id, root);
  return snapshot;
}
