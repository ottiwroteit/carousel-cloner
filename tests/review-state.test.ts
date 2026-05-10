import { describe, expect, test } from "vitest";
import { acceptCurrentSlot, rejectCurrentSlot, type ReviewState } from "@/lib/review/state";

function state(): ReviewState {
  return {
    jobId: "job",
    currentIndex: 0,
    complete: false,
    slots: [
      {
        position: 1,
        title: "Hero",
        kind: "storefront-hook",
        currentCandidate: "generated/slide-01.png",
        rejectedImages: [],
        rejectCount: 0
      },
      {
        position: 2,
        title: "Product",
        kind: "product-photo",
        productName: "Siete Chips",
        currentCandidate: "generated/slide-02.png",
        rejectedImages: [],
        rejectCount: 0
      }
    ]
  };
}

describe("review state", () => {
  test("accepts the current slot and advances", () => {
    const next = acceptCurrentSlot(state());

    expect(next.slots[0].acceptedImage).toBe("generated/slide-01.png");
    expect(next.currentIndex).toBe(1);
    expect(next.complete).toBe(false);
  });

  test("marks complete after the final slot is accepted", () => {
    const initial = state();
    initial.currentIndex = 1;

    const next = acceptCurrentSlot(initial);

    expect(next.slots[1].acceptedImage).toBe("generated/slide-02.png");
    expect(next.complete).toBe(true);
  });

  test("rejects the current slot and tracks the count", () => {
    const next = rejectCurrentSlot(state(), "generated/slide-01b.png");

    expect(next.slots[0].rejectedImages).toEqual(["generated/slide-01.png"]);
    expect(next.slots[0].currentCandidate).toBe("generated/slide-01b.png");
    expect(next.slots[0].rejectCount).toBe(1);
    expect(next.currentIndex).toBe(0);
  });
});
