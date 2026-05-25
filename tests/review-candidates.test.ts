import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import sharp from "sharp";
import { generateReviewCandidate } from "@/lib/review/candidates";

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("generateReviewCandidate", () => {
  test("uses local 9:16 composition for early product rejections", async () => {
    root = await mkdtemp(path.join(tmpdir(), "review-candidate-"));
    const jobDir = path.join(root, "job");
    await mkdir(path.join(jobDir, "generated"), { recursive: true });
    await writeFile(path.join(jobDir, "generated", "source.png"), await sharp({ create: { width: 600, height: 600, channels: 4, background: "#ffffff" } }).png().toBuffer());

    const candidate = await generateReviewCandidate({
      jobId: "job",
      root,
      nextRejectCount: 1,
      slot: {
        position: 2,
        title: "Product",
        kind: "product-photo",
        productName: "Siete Chips",
        currentCandidate: "generated/source.png",
        sourceImage: "generated/source.png",
        rejectedImages: [],
        rejectCount: 0
      }
    });

    const meta = await sharp(await readFile(path.join(jobDir, candidate))).metadata();
    expect(candidate).toContain("review-02");
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
  });

  test("uses GPT fallback on the third product rejection", async () => {
    const candidate = await generateReviewCandidate({
      jobId: "job",
      root: "/tmp",
      nextRejectCount: 3,
      slot: {
        position: 2,
        title: "Product",
        kind: "product-photo",
        productName: "Siete Chips",
        currentCandidate: "generated/source.png",
        sourceImage: "generated/source.png",
        rejectedImages: [],
        rejectCount: 2
      },
      generateOpenAIImages: async () => ["generated/gpt.png"]
    });

    expect(candidate).toBe("generated/gpt.png");
  });

  test("uses public hook text for GPT hero candidates", async () => {
    let prompt = "";
    root = await mkdtemp(path.join(tmpdir(), "review-candidate-"));
    const jobDir = path.join(root, "job");
    await mkdir(path.join(jobDir, "generated"), { recursive: true });
    await writeFile(
      path.join(jobDir, "generated", "hero-gpt.png"),
      await sharp({ create: { width: 1024, height: 1536, channels: 4, background: "#222222" } }).png().toBuffer()
    );

    const candidate = await generateReviewCandidate({
      jobId: "job",
      root,
      nextRejectCount: 3,
      slot: {
        position: 1,
        title: "Better Memorial Day cookout swaps",
        kind: "storefront-hook",
        currentCandidate: "generated/source.png",
        sourceImage: "generated/source.png",
        rejectedImages: [],
        rejectCount: 2
      },
      generateOpenAIImages: async ({ prompts }) => {
        prompt = prompts[0];
        return ["generated/hero-gpt.png"];
      }
    });

    const meta = await sharp(await readFile(path.join(jobDir, candidate))).metadata();
    expect(candidate).toBe("generated/review-01-better-memorial-day-cookout-swaps-3.png");
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
    expect(prompt).toContain('titled "Better Memorial Day cookout swaps"');
    expect(prompt).toContain("No overlay text");
  });
});
