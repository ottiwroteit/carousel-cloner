import { describe, expect, test } from "vitest";
import { getInitialReviewPreview, reviewClientScript } from "@/lib/phone/review-preview";
import type { ReviewState } from "@/lib/review/state";

const state: ReviewState = {
  jobId: "job",
  currentIndex: 1,
  complete: false,
  slots: [
    {
      position: 1,
      title: "Hero",
      kind: "storefront-hook",
      currentCandidate: "generated/review-01.png",
      rejectedImages: [],
      rejectCount: 1,
      acceptedImage: "generated/review-01.png"
    },
    {
      position: 2,
      title: "Product",
      kind: "product-photo",
      productName: "Siete Chips",
      currentCandidate: "generated/review-02.png",
      rejectedImages: [],
      rejectCount: 0
    }
  ]
};

describe("phone review preview", () => {
  test("uses persisted review state for the server-rendered candidate", () => {
    expect(getInitialReviewPreview(state)).toEqual({
      title: "Siete Chips",
      step: "Product slide",
      count: "2/2",
      image: "generated/review-02.png",
      detail: "Swipe right to keep. Swipe left to try another option.",
      complete: false
    });
  });

  test("does not fetch and mutate the review image before hydration", () => {
    const script = reviewClientScript();

    expect(script).toContain("request(action)");
    expect(script).not.toContain("request();");
  });
});
