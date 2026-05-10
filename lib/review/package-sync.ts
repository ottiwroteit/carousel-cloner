import { readJob, writeJobArtifact } from "@/lib/jobs/store";
import type { ReviewSlot } from "@/lib/review/state";
import type { CarouselSlidePlan, GeneratedPackage } from "@/lib/types";

function slideImageList(slides: CarouselSlidePlan[]): string[] {
  return slides.flatMap((slide) => {
    if (slide.kind === "bare-screenshot" || !slide.generatedImage) {
      return [];
    }

    return [slide.generatedImage];
  });
}

export async function applyAcceptedSlotToPackage(jobId: string, slot: ReviewSlot, root?: string): Promise<void> {
  const acceptedImage = slot.acceptedImage ?? slot.currentCandidate;
  if (!acceptedImage) {
    return;
  }

  const job = await readJob(jobId, root);
  const pkg = job.artifacts["package.json"] as GeneratedPackage | undefined;
  if (!pkg) {
    throw new Error("Job package.json is missing.");
  }

  const carouselSlides = (pkg.carouselSlides ?? []).map((slide) => {
    if (slide.position !== slot.position) {
      return slide;
    }

    return {
      ...slide,
      generatedImage: acceptedImage
    };
  });

  await writeJobArtifact(
    jobId,
    "package.json",
    {
      ...pkg,
      carouselSlides,
      generatedImages: slideImageList(carouselSlides)
    },
    root
  );
}
