import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { createJob, readJob, writeJobArtifact } from "@/lib/jobs/store";
import { applyAcceptedSlotToPackage } from "@/lib/review/package-sync";
import type { ReviewSlot } from "@/lib/review/state";
import type { GeneratedPackage, StyleProfile } from "@/lib/types";

const profile: StyleProfile = {
  accountName: "Carousel Cloner",
  targetAudience: "solo creators",
  topics: [],
  tone: "",
  captionRules: "",
  imageStyle: "",
  bannedElements: [],
  ctaStyle: ""
};

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("applyAcceptedSlotToPackage", () => {
  test("updates the generated package image list with the accepted review candidate", async () => {
    root = await mkdtemp(path.join(tmpdir(), "review-package-sync-"));
    const job = await createJob({ url: "https://example.com/source", profile }, root);
    const pkg: GeneratedPackage = {
      title: "Memorial Day swaps",
      mainCaption: "Caption",
      alternateHooks: [],
      hashtags: [],
      slideText: [],
      postingNotes: [],
      generatedImages: ["generated/slide-01.png", "generated/slide-02.png"],
      carouselSlides: [
        {
          position: 1,
          kind: "storefront-hook",
          title: "Better Memorial Day cookout",
          generatedImage: "generated/slide-01.png"
        },
        {
          position: 2,
          kind: "product-photo",
          title: "Product",
          productName: "Siete Chips",
          generatedImage: "generated/slide-02.png"
        },
        {
          position: 3,
          kind: "bare-screenshot",
          title: "BARE screenshot",
          productName: "Siete Chips"
        }
      ]
    };
    await writeJobArtifact(job.status.id, "package.json", pkg, root);

    const slot: ReviewSlot = {
      position: 2,
      title: "Product",
      kind: "product-photo",
      productName: "Siete Chips",
      currentCandidate: "generated/review-02-siete-chips-1.png",
      acceptedImage: "generated/review-02-siete-chips-1.png",
      rejectedImages: [],
      rejectCount: 1
    };

    await applyAcceptedSlotToPackage(job.status.id, slot, root);

    const updated = (await readJob(job.status.id, root)).artifacts["package.json"] as GeneratedPackage;
    expect(updated.carouselSlides?.[1].generatedImage).toBe("generated/review-02-siete-chips-1.png");
    expect(updated.generatedImages).toEqual(["generated/slide-01.png", "generated/review-02-siete-chips-1.png"]);
  });
});
