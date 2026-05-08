import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { createJob, readJob, updateJobStatus, writeJobArtifact } from "@/lib/jobs/store";
import type { StyleProfile } from "@/lib/types";

const profile: StyleProfile = {
  accountName: "Otti",
  targetAudience: "solo creators",
  topics: ["automation", "content systems"],
  tone: "sharp and useful",
  captionRules: "short paragraphs",
  imageStyle: "clean product screenshots",
  bannedElements: ["fake UI claims"],
  ctaStyle: "soft question"
};

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("job store", () => {
  test("creates a job folder with input and queued status", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-jobs-"));

    const job = await createJob({ url: "https://www.tiktok.com/@creator/video/1", profile }, root);

    expect(job.status.state).toBe("queued");
    expect(job.input.url).toBe("https://www.tiktok.com/@creator/video/1");
    expect(job.dir).toContain(job.status.id);
  });

  test("updates status and reads JSON artifacts", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-jobs-"));
    const job = await createJob({ url: "https://www.tiktok.com/@creator/video/1", profile }, root);

    await updateJobStatus(job.status.id, { state: "analyzing", progress: 45, message: "Reading source" }, root);
    await writeJobArtifact(job.status.id, "analysis.json", { hook: "Start with a painful truth" }, root);

    const snapshot = await readJob(job.status.id, root);

    expect(snapshot.status.state).toBe("analyzing");
    expect(snapshot.status.progress).toBe(45);
    expect(snapshot.artifacts["analysis.json"]).toEqual({ hook: "Start with a painful truth" });
  });
});
