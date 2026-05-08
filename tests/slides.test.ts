import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { generateSlideImages, renderSlideSvg } from "@/lib/generator/slides";
import type { GeneratedPackage, StyleProfile } from "@/lib/types";

const profile: StyleProfile = {
  accountName: "Carousel Cloner",
  targetAudience: "founders",
  topics: ["automation"],
  tone: "direct",
  captionRules: "short",
  imageStyle: "clean interface screenshots",
  bannedElements: ["hype"],
  ctaStyle: "soft"
};

const pkg: GeneratedPackage = {
  title: "Local draft carousel",
  mainCaption: "Caption",
  alternateHooks: [],
  hashtags: [],
  slideText: ["Find a working slideshow", "Rewrite it in your style"],
  postingNotes: []
};

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("slide image generation", () => {
  test("renders escaped vertical SVG slide markup", () => {
    const svg = renderSlideSvg({
      index: 1,
      total: 2,
      title: "Find & remix <fast>",
      profile
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("Find &amp; remix &lt;fast&gt;");
    expect(svg).toContain("1/2");
  });

  test("writes one generated image per slide and returns relative paths", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-slides-"));

    const images = await generateSlideImages(root, pkg, profile);

    expect(images).toEqual(["generated/slide-01.svg", "generated/slide-02.svg"]);
    await expect(readFile(path.join(root, images[0]), "utf8")).resolves.toContain("Find a working slideshow");
  });
});
