import { describe, expect, test } from "vitest";
import { captionCopyScript } from "@/lib/phone/caption-copy";

describe("captionCopyScript", () => {
  test("makes insecure mobile clipboard fallback visible to the user", () => {
    const script = captionCopyScript();

    expect(script).toContain("scrollIntoView");
    expect(script).toContain("Tap Copy");
    expect(script).toContain("data-copy-caption-status");
  });
});
