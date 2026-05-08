import { describe, expect, test } from "vitest";
import { validateTikTokUrl } from "@/lib/url";

describe("validateTikTokUrl", () => {
  test("accepts TikTok video URLs and normalizes whitespace", () => {
    const result = validateTikTokUrl(" https://www.tiktok.com/@creator/video/7360000000000000000 ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe("https://www.tiktok.com/@creator/video/7360000000000000000");
      expect(result.hostname).toBe("www.tiktok.com");
    }
  });

  test("accepts short TikTok URLs", () => {
    const result = validateTikTokUrl("https://vt.tiktok.com/ZSYabc123/");

    expect(result.ok).toBe(true);
  });

  test("rejects non-TikTok URLs", () => {
    const result = validateTikTokUrl("https://instagram.com/p/example");

    expect(result).toEqual({
      ok: false,
      message: "Enter a TikTok slideshow or video URL."
    });
  });

  test("rejects malformed URLs", () => {
    const result = validateTikTokUrl("not a url");

    expect(result).toEqual({
      ok: false,
      message: "Enter a valid URL."
    });
  });
});
