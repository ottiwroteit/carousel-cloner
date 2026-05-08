import { describe, expect, test } from "vitest";
import { extractTikTokSource, normalizeExtractorError } from "@/lib/extractors/tiktok";

describe("TikTok extractor", () => {
  test("normalizes missing yt-dlp errors", () => {
    expect(normalizeExtractorError(new Error("spawn yt-dlp ENOENT"))).toEqual({
      code: "missing_yt_dlp",
      message: "yt-dlp is not installed or is not available on PATH."
    });
  });

  test("returns blocked errors from failed runner output", async () => {
    const result = await extractTikTokSource({
      url: "https://www.tiktok.com/@creator/video/1",
      jobDir: "/tmp/job",
      run: async () => ({
        ok: false,
        stdout: "",
        stderr: "HTTP Error 403: Forbidden"
      })
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "blocked",
        message: "TikTok blocked direct extraction for this URL."
      }
    });
  });

  test("maps yt-dlp JSON metadata into a source artifact", async () => {
    const result = await extractTikTokSource({
      url: "https://www.tiktok.com/@creator/video/1",
      jobDir: "/tmp/job",
      run: async () => ({
        ok: true,
        stdout: JSON.stringify({
          id: "1",
          title: "Example",
          webpage_url: "https://www.tiktok.com/@creator/video/1",
          thumbnails: [{ url: "https://example.com/slide.jpg" }]
        }),
        stderr: ""
      })
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source.images).toEqual(["https://example.com/slide.jpg"]);
      expect(result.source.metadata.title).toBe("Example");
    }
  });
});
