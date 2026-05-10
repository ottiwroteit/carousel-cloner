import { formatCaptionPackage } from "@/lib/export/captions";
import { extractTikTokSource, type ExtractTikTokSourceResult } from "@/lib/extractors/tiktok";
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
import type { SourceAnalysis } from "@/lib/types";

type ProcessJobOptions = {
  root?: string;
  extract?: (url: string, jobDir: string) => Promise<ExtractTikTokSourceResult>;
  hasOpenAIKey?: boolean;
  useOpenAIImages?: boolean;
  generateOpenAIImages?: typeof generateOpenAIImages;
  findWebProductImage?: typeof findWebProductImage;
  readBareCatalog?: typeof readBareCatalog;
};

type ImageGenerationArtifact =
  | { provider: "openai"; model: string; quality: string; outputFormat: string }
  | { provider: "hybrid-web-openai"; model: string; quality: string; outputFormat: string; productSources: WebProductImage[] }
  | { provider: "local-svg"; reason: string };

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
  let catalogProducts;
  try {
    catalogProducts = selectBareProducts(await catalogReader(), 3);
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
  } catch {
    catalogProducts = undefined;
  }

  let generated = buildTrendPackage({ bareProducts: catalogProducts });
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

  await writeJobArtifact(id, "package.json", generated, root);
  await writeJobTextArtifact(id, "captions.txt", formatCaptionPackage(generated), root);

  await updateJobStatus(id, { state: "ready", progress: 100, message: "Caption package is ready" }, root);
  snapshot = await readJob(id, root);
  return snapshot;
}
