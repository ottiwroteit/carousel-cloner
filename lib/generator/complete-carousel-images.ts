import path from "node:path";
import sharp from "sharp";
import { composeBareProofImage } from "@/lib/generator/compose-bare-proof-image";
import { captureBareProductScreenshot } from "@/lib/generator/bare-simulator-screenshots";
import { composeProductImage } from "@/lib/generator/compose-product-image";
import type { CarouselSlidePlan, GeneratedPackage } from "@/lib/types";

type CompleteCarouselImagesOptions = {
  jobDir: string;
  pkg: GeneratedPackage;
  useBareSimulatorScreenshots?: boolean;
  requireBareSimulatorScreenshots?: boolean;
  captureBareScreenshot?: (slide: CarouselSlidePlan, outputName: string) => Promise<string>;
};

function publicImages(slides: NonNullable<GeneratedPackage["carouselSlides"]>): string[] {
  return slides.flatMap((slide) => (slide.generatedImage ? [slide.generatedImage] : []));
}

async function ensurePng(jobDir: string, relativePath: string, outputName: string): Promise<string> {
  if (relativePath.toLowerCase().endsWith(".png")) {
    return relativePath;
  }

  const nextRelativePath = path.join("generated", `${outputName}.png`);
  await sharp(path.join(jobDir, relativePath))
    .resize({ width: 1080, height: 1920, fit: "cover" })
    .png()
    .toFile(path.join(jobDir, nextRelativePath));
  return nextRelativePath;
}

async function extractProductImageFromBareScreenshot(jobDir: string, rawRelativePath: string, outputName: string): Promise<string> {
  const rawPath = path.join(jobDir, rawRelativePath);
  const metadata = await sharp(rawPath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    throw new Error(`Cannot extract product image from ${rawRelativePath}: invalid screenshot dimensions.`);
  }

  const cropSize = Math.round(width * 0.14);
  const left = Math.round(width * 0.055);
  const top = Math.round(height * 0.155);
  const sourceRelativePath = path.join("generated", `${outputName}-product-source.png`);
  await sharp(rawPath)
    .extract({
      left,
      top,
      width: Math.min(cropSize, width - left),
      height: Math.min(cropSize, height - top)
    })
    .resize({ width: 900, height: 900, fit: "contain", background: "#ffffff" })
    .png()
    .toFile(path.join(jobDir, sourceRelativePath));

  return sourceRelativePath;
}

export async function completeCarouselImages({
  jobDir,
  pkg,
  useBareSimulatorScreenshots = false,
  requireBareSimulatorScreenshots = false,
  captureBareScreenshot
}: CompleteCarouselImagesOptions): Promise<GeneratedPackage> {
  const slides = pkg.carouselSlides ?? [];
  const completed = [];
  let lastProductImage: string | undefined;

  for (const slide of slides) {
    if (slide.kind === "bare-screenshot") {
      const outputName = `slide-${String(slide.position).padStart(2, "0")}-bare-proof`;
      if (useBareSimulatorScreenshots && slide.barcode) {
        try {
          const generatedImage =
            slide.generatedImage ??
            (captureBareScreenshot
              ? await captureBareScreenshot(slide, outputName)
              : await captureBareProductScreenshot({
                  jobDir,
                  barcode: slide.barcode,
                  productName: slide.productName,
                  outputName
                }));
          const previous = completed.at(-1);
          if (previous?.kind === "product-photo" && previous.barcode === slide.barcode) {
            const rawRelativePath = path.join("generated", `${outputName}-raw.png`);
            const productSource = await extractProductImageFromBareScreenshot(jobDir, rawRelativePath, outputName);
            const productImage = await composeProductImage({
              jobDir,
              sourceRelativePath: productSource,
              outputName: `slide-${String(previous.position).padStart(2, "0")}`,
              variant: previous.position
            });
            completed[completed.length - 1] = { ...previous, generatedImage: productImage };
            lastProductImage = productImage;
          }
          completed.push({ ...slide, generatedImage });
          continue;
        } catch (error) {
          if (requireBareSimulatorScreenshots) {
            throw error;
          }
        }
      }

      const generatedImage =
        slide.generatedImage ??
        (await composeBareProofImage({
          jobDir,
          slide,
          sourceRelativePath: lastProductImage,
          outputName
        }));
      completed.push({ ...slide, generatedImage });
      continue;
    }

    const generatedImage = slide.generatedImage
      ? await ensurePng(jobDir, slide.generatedImage, `slide-${String(slide.position).padStart(2, "0")}`)
      : slide.generatedImage;

    if (slide.kind === "product-photo" && generatedImage) {
      lastProductImage = generatedImage;
    }

    completed.push({ ...slide, generatedImage });
  }

  return {
    ...pkg,
    generatedImages: publicImages(completed),
    carouselSlides: completed
  };
}
