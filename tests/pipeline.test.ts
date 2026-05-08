import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { createJob, readJob, readJobTextArtifact } from "@/lib/jobs/store";
import { processJob } from "@/lib/generator/pipeline";
import type { StyleProfile } from "@/lib/types";

const profile: StyleProfile = {
  accountName: "Otti",
  targetAudience: "founders posting daily",
  topics: ["automation", "AI workflows"],
  tone: "direct and useful",
  captionRules: "write like a smart operator",
  imageStyle: "clean app UI screenshots with crisp text",
  bannedElements: ["hype"],
  ctaStyle: "ask a practical question"
};

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("processJob", () => {
  test("creates fallback analysis, package, and captions when extraction fails", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-pipeline-"));
    const job = await createJob({ url: "https://www.tiktok.com/@creator/video/1", profile }, root);

    const snapshot = await processJob(job.status.id, {
      root,
      extract: async () => ({
        ok: false,
        error: {
          code: "blocked",
          message: "TikTok blocked direct extraction for this URL."
        }
      })
    });

    const captions = await readJobTextArtifact(job.status.id, "captions.txt", root);
    const readBack = await readJob(job.status.id, root);

    expect(snapshot.status.state).toBe("ready");
    expect(readBack.artifacts["analysis.json"]).toMatchObject({
      hook: "Direct TikTok extraction was blocked"
    });
    expect(readBack.artifacts["package.json"]).toMatchObject({
      title: "Local draft carousel for Otti"
    });
    expect(captions).toContain("Main caption:");
    expect(captions).toContain("# Local draft carousel for Otti");
  });
});
