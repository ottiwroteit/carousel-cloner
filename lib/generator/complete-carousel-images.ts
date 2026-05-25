import path from "node:path";
import sharp from "sharp";
import { composeBareProofImage } from "@/lib/generator/compose-bare-proof-image";
import type { GeneratedPackage } from "@/lib/types";

type CompleteCarouselImagesOptions = {
  jobDir: string;
  pkg: GeneratedPackage;
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

export async function completeCarouselImages({ jobDir, pkg }: CompleteCarouselImagesOptions): Promise<GeneratedPackage> {
  const slides = pkg.carouselSlides ?? [];
  const completed = [];
  let lastProductImage: string | undefined;

  for (const slide of slides) {
    if (slide.kind === "bare-screenshot") {
      const generatedImage =
        slide.generatedImage ??
        (await composeBareProofImage({
          jobDir,
          slide,
          sourceRelativePath: lastProductImage,
          outputName: `slide-${String(slide.position).padStart(2, "0")}-bare-proof`
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
