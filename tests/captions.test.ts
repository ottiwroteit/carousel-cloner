import { describe, expect, test } from "vitest";
import { formatCaptionPackage } from "@/lib/export/captions";
import type { GeneratedPackage } from "@/lib/types";

describe("formatCaptionPackage", () => {
  test("formats a complete caption package for copying", () => {
    const pkg: GeneratedPackage = {
      title: "Quiet systems beat chaotic posting",
      mainCaption: "Your content calendar does not need more panic. It needs a repeatable machine.",
      alternateHooks: ["Stop rebuilding every carousel from scratch", "A better workflow for daily posts"],
      hashtags: ["#contentworkflow", "#socialmediasystems"],
      slideText: [
        "Steal the structure, not the post",
        "Rewrite the angle for your audience",
        "Export captions before you open the app"
      ],
      postingNotes: ["Use this for a 5-slide carousel.", "Keep the CTA soft."]
    };

    expect(formatCaptionPackage(pkg)).toBe(`# Quiet systems beat chaotic posting

Main caption:
Your content calendar does not need more panic. It needs a repeatable machine.

Alternate hooks:
1. Stop rebuilding every carousel from scratch
2. A better workflow for daily posts

Slide text:
1. Steal the structure, not the post
2. Rewrite the angle for your audience
3. Export captions before you open the app

Hashtags:
#contentworkflow #socialmediasystems

Posting notes:
- Use this for a 5-slide carousel.
- Keep the CTA soft.
`);
  });
});
