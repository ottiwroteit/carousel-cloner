import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getJobDir, readJob } from "@/lib/jobs/store";
import type { CarouselSlidePlan, GeneratedPackage } from "@/lib/types";

export type ReviewSlot = {
  position: number;
  title: string;
  kind: CarouselSlidePlan["kind"];
  productName?: string;
  barcode?: string;
  acceptedImage?: string;
  currentCandidate?: string;
  sourceImage?: string;
  rejectedImages: string[];
  rejectCount: number;
};

export type ReviewState = {
  jobId: string;
  currentIndex: number;
  complete: boolean;
  slots: ReviewSlot[];
};

const REVIEW_FILE = "review.json";

function reviewPath(jobId: string, root?: string): string {
  return path.join(getJobDir(jobId, root), REVIEW_FILE);
}

function generatedSlots(pkg: GeneratedPackage): ReviewSlot[] {
  return (pkg.carouselSlides ?? [])
    .filter((slide) => slide.kind !== "bare-screenshot")
    .map((slide) => ({
      position: slide.position,
      title: slide.title,
      kind: slide.kind,
      productName: slide.productName,
      barcode: slide.barcode,
      currentCandidate: slide.generatedImage,
      sourceImage: slide.generatedImage,
      rejectedImages: [],
      rejectCount: 0
    }));
}

export async function getOrCreateReviewState(jobId: string, root?: string): Promise<ReviewState> {
  try {
    return JSON.parse(await readFile(reviewPath(jobId, root), "utf8")) as ReviewState;
  } catch {
    const job = await readJob(jobId, root);
    const pkg = job.artifacts["package.json"] as GeneratedPackage;
    const state: ReviewState = {
      jobId,
      currentIndex: 0,
      complete: false,
      slots: generatedSlots(pkg)
    };
    await saveReviewState(state, root);
    return state;
  }
}

export async function saveReviewState(state: ReviewState, root?: string): Promise<void> {
  await writeFile(reviewPath(state.jobId, root), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function acceptCurrentSlot(state: ReviewState): ReviewState {
  const slot = state.slots[state.currentIndex];
  if (!slot) {
    return { ...state, complete: true };
  }

  const slots = [...state.slots];
  slots[state.currentIndex] = {
    ...slot,
    acceptedImage: slot.currentCandidate
  };
  const nextIndex = state.currentIndex + 1;

  return {
    ...state,
    slots,
    currentIndex: Math.min(nextIndex, slots.length - 1),
    complete: nextIndex >= slots.length
  };
}

export function rejectCurrentSlot(state: ReviewState, nextCandidate?: string): ReviewState {
  const slot = state.slots[state.currentIndex];
  if (!slot) {
    return state;
  }

  const slots = [...state.slots];
  slots[state.currentIndex] = {
    ...slot,
    currentCandidate: nextCandidate ?? slot.currentCandidate,
    rejectedImages: slot.currentCandidate ? [...slot.rejectedImages, slot.currentCandidate] : slot.rejectedImages,
    rejectCount: slot.rejectCount + 1
  };

  return {
    ...state,
    slots
  };
}
