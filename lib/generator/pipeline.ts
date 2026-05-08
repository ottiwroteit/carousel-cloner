import { formatCaptionPackage } from "@/lib/export/captions";
import { extractTikTokSource, type ExtractTikTokSourceResult } from "@/lib/extractors/tiktok";
import { generateOpenAIImages, getOpenAIImageConfig } from "@/lib/generator/openai-images";
import { generateSlideImages } from "@/lib/generator/slides";
import {
  DEFAULT_JOBS_ROOT,
  readJob,
  updateJobStatus,
  writeJobArtifact,
  writeJobTextArtifact,
  type JobSnapshot
} from "@/lib/jobs/store";
import type { GeneratedPackage, SourceAnalysis } from "@/lib/types";

type ProcessJobOptions = {
  root?: string;
  extract?: (url: string, jobDir: string) => Promise<ExtractTikTokSourceResult>;
};

function buildFallbackAnalysis(reason: string): SourceAnalysis {
  return {
    summary: "Direct extraction did not return source slides, so this is a local draft based on the requested account style.",
    hook: reason.includes("blocked") ? "Direct TikTok extraction was blocked" : reason,
    pacing: "Use a five-slide structure: problem, pattern, method, payoff, CTA.",
    visualPattern: "Clean vertical slides with one primary idea per image.",
    captionStrategy: "Open with the workflow pain, then make the saved-time benefit concrete.",
    whyItWorks: "It still produces usable captions and slide copy while keeping the failed extractor details visible."
  };
}

function buildLocalPackage(): GeneratedPackage {
  return {
    title: "Local draft carousel",
    mainCaption:
      "You do not need to reinvent every carousel. Start by studying the structure that is already working, then rebuild the idea in your own voice and visual system.",
    alternateHooks: [
      "Stop starting every carousel from a blank page",
      "The faster way to turn working posts into original content"
    ],
    hashtags: ["#contentautomation", "#creatorworkflow", "#socialmediatips"],
    slideText: [
      "Find a slideshow already getting traction",
      "Extract the pattern behind the post",
      "Rewrite the angle for your audience",
      "Generate new visuals in your account style",
      "Copy the caption package and post natively"
    ],
    postingNotes: [
      "Review the source analysis before posting.",
      "Replace any generic phrasing with a recent example from your own work."
    ],
    imagePrompts: [
      "Vertical carousel slide, clean app dashboard aesthetic, headline about finding a working slideshow",
      "Vertical carousel slide, structured analysis cards, headline about extracting the pattern",
      "Vertical carousel slide, crisp writing interface, headline about rewriting the angle",
      "Vertical carousel slide, polished generated images grid, headline about account style",
      "Vertical carousel slide, caption export panel, headline about posting natively"
    ],
    generatedImages: []
  };
}

export async function processJob(id: string, options: ProcessJobOptions = {}): Promise<JobSnapshot> {
  const root = options.root ?? DEFAULT_JOBS_ROOT;
  let snapshot = await readJob(id, root);

  await updateJobStatus(id, { state: "extracting", progress: 15, message: "Extracting TikTok source" }, root);

  const extract =
    options.extract ??
    ((url: string, jobDir: string) =>
      extractTikTokSource({
        url,
        jobDir,
        cookiesFile: process.env.TIKTOK_COOKIES_FILE
      }));
  const extraction = await extract(snapshot.input.url, snapshot.dir);

  await updateJobStatus(id, { state: "analyzing", progress: 45, message: "Analyzing source pattern" }, root);

  const analysis = extraction.ok
    ? {
        summary: `Read ${extraction.source.images.length} source image reference(s) from TikTok metadata.`,
        hook: "Source slideshow metadata was available for analysis",
        pacing: "Mirror the source sequence length while changing the creative angle.",
        visualPattern: extraction.source.warning ?? "Use the extracted image references as visual research only.",
        captionStrategy: "Rewrite the promise in the account voice.",
        whyItWorks: "The source has a proven format, and the output uses that structure without copying the asset."
      }
    : buildFallbackAnalysis(extraction.error.message);

  await writeJobArtifact(id, "analysis.json", analysis, root);
  if (extraction.ok) {
    await writeJobArtifact(id, "source.json", extraction.source, root);
  } else {
    await writeJobArtifact(id, "extractor-error.json", extraction.error, root);
  }

  await updateJobStatus(id, { state: "generating_copy", progress: 70, message: "Generating captions and slide text" }, root);

  const generated = buildLocalPackage();
  if (process.env.OPENAI_API_KEY) {
    const imageConfig = getOpenAIImageConfig();
    generated.generatedImages = await generateOpenAIImages({
      jobDir: snapshot.dir,
      prompts: generated.imagePrompts ?? generated.slideText,
      config: imageConfig
    });
    await writeJobArtifact(
      id,
      "image-generation.json",
      {
        provider: "openai",
        model: imageConfig.model,
        quality: imageConfig.quality,
        outputFormat: "png"
      },
      root
    );
  } else {
    generated.generatedImages = await generateSlideImages(snapshot.dir, generated, snapshot.input.profile);
    await writeJobArtifact(
      id,
      "image-generation.json",
      {
        provider: "local-svg",
        reason: "OPENAI_API_KEY is not set."
      },
      root
    );
  }
  await writeJobArtifact(id, "package.json", generated, root);
  await writeJobTextArtifact(id, "captions.txt", formatCaptionPackage(generated), root);

  await updateJobStatus(id, { state: "ready", progress: 100, message: "Caption package is ready" }, root);
  snapshot = await readJob(id, root);
  return snapshot;
}
