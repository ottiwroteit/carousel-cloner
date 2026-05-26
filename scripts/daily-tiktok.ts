import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { formatCaptionPackage } from "../lib/export/captions";
import { completeCarouselImages } from "../lib/generator/complete-carousel-images";
import { processJob } from "../lib/generator/pipeline";
import { createJob, writeJobArtifact, writeJobTextArtifact } from "../lib/jobs/store";
import { createPostizDraft, listPostizIntegrations, uploadPostizImage, type PostizIntegration } from "../lib/postiz/client";
import type { GeneratedPackage, StyleProfile } from "../lib/types";

type DraftResult = {
  jobId: string;
  jobDir: string;
  date: string;
  integrationId: string;
  imageCount: number;
  postizResponse?: unknown;
};

const DEFAULT_POSTIZ_BASE_URL = "http://localhost:4007/api/public/v1";
const DEFAULT_TIKTOK_PROFILE = "downloadbare";
const DEFAULT_SLOTS = ["12:30", "15:00", "18:00"];
const STOREFRONT_STORES = ["Trader Joe's", "Sprouts", "Kroger", "Publix", "H-E-B", "Jewel-Osco"];

const defaultProfile: StyleProfile = {
  accountName: "Carousel Cloner",
  targetAudience: "health-conscious grocery shoppers",
  topics: ["clean ingredients", "grocery finds", "food scanner app"],
  tone: "specific, useful, and TikTok-native",
  captionRules: "Keep captions short and easy to paste into TikTok.",
  imageStyle: "9:16 grocery carousel slides with product proof",
  bannedElements: ["raw meat", "raw chicken", "uncooked poultry"],
  ctaStyle: "save this for your next grocery run"
};

function loadLocalEnv(filePath = path.join(process.cwd(), ".env.local")): void {
  if (!existsSync(filePath)) {
    return;
  }

  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = rest.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

function parseArgs(): { dryRun: boolean; count: number } {
  const args = new Set(process.argv.slice(2));
  const countArg = process.argv.find((arg) => arg.startsWith("--count="));
  const count = countArg ? Number(countArg.split("=")[1]) : 3;
  return {
    dryRun: args.has("--dry-run"),
    count: Number.isFinite(count) && count > 0 ? count : 3
  };
}

function nextSlotDate(slot: string, index: number): Date {
  const [hour = "9", minute = "0"] = slot.split(":");
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);
  if (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  date.setMinutes(date.getMinutes() + index);
  return date;
}

function storeForDraft(index: number): string {
  const daySeed = Math.floor(Date.now() / 86_400_000);
  return STOREFRONT_STORES[(daySeed + index) % STOREFRONT_STORES.length];
}

function captionForPackage(pkg: GeneratedPackage): string {
  const tags = pkg.hashtags.join(" ");
  const caption = `${pkg.mainCaption}\n\n${tags}`.trim();
  return caption.length > 2150 ? caption.slice(0, 2147).trimEnd() + "..." : caption;
}

function findTikTokIntegration(integrations: PostizIntegration[], profile: string): PostizIntegration {
  const match = integrations.find(
    (integration) =>
      integration.identifier === "tiktok" &&
      [integration.profile, integration.name].filter(Boolean).some((value) => value?.toLowerCase() === profile.toLowerCase())
  );

  if (!match) {
    const available = integrations
      .filter((integration) => integration.identifier === "tiktok")
      .map((integration) => integration.profile ?? integration.name ?? integration.id)
      .join(", ");
    throw new Error(`TikTok integration "${profile}" was not found in Postiz. Available TikTok profiles: ${available || "none"}.`);
  }

  return match;
}

async function finalizePackage(jobId: string, jobDir: string, pkg: GeneratedPackage): Promise<GeneratedPackage> {
  const completed = await completeCarouselImages({ jobDir, pkg });
  await writeJobArtifact(jobId, "package.json", completed);
  await writeJobTextArtifact(jobId, "captions.txt", formatCaptionPackage(completed));
  return completed;
}

async function assertCarouselReadyForUpload(pkg: GeneratedPackage, imagePaths: string[]): Promise<void> {
  if ((pkg.carouselSlides ?? []).length !== 7 || imagePaths.length !== 7) {
    throw new Error(`Upload blocked: expected 7 carousel images, received ${imagePaths.length}.`);
  }

  const heroPath = imagePaths[0];
  if (!heroPath.toLowerCase().endsWith(".png")) {
    throw new Error(`Upload blocked: hero slide must be a PNG, received ${path.basename(heroPath)}.`);
  }

  const metadata = await sharp(heroPath).metadata();
  if (metadata.width !== 1080 || metadata.height !== 1920) {
    throw new Error(`Upload blocked: hero slide must be 1080x1920, received ${metadata.width}x${metadata.height}.`);
  }

  const stats = await sharp(heroPath).stats();
  const meanLuminance =
    (stats.channels[0]?.mean ?? 0) * 0.2126 + (stats.channels[1]?.mean ?? 0) * 0.7152 + (stats.channels[2]?.mean ?? 0) * 0.0722;
  if (meanLuminance < 65) {
    throw new Error("Upload blocked: hero slide is too dark or blank-looking for TikTok.");
  }

  const firstSlide = pkg.carouselSlides?.[0];
  if (!firstSlide?.generatedImage || firstSlide.kind !== "storefront-hook") {
    throw new Error("Upload blocked: first slide is not a generated hero slide.");
  }
}

async function buildOneDraft(slotDate: Date, integrationId: string, dryRun: boolean, index: number): Promise<DraftResult> {
  const storeName = storeForDraft(index);
  const job = await createJob({
    url: "https://www.tiktok.com/@downloadbare",
    profile: defaultProfile
  });

  const snapshot = await processJob(job.status.id, {
    useOpenAIImages: process.env.CAROUSEL_USE_OPENAI_IMAGES === "1",
    forceStorefrontHero: true,
    storeName,
    useStockHeroImages: true,
    useBareSimulatorScreenshots: true,
    requireBareSimulatorScreenshots: true
  });
  const pkg = await finalizePackage(job.status.id, snapshot.dir, snapshot.artifacts["package.json"] as GeneratedPackage);
  const images = (pkg.generatedImages ?? []).map((relativePath) => path.join(snapshot.dir, relativePath));
  const caption = captionForPackage(pkg);

  if (images.length === 0) {
    throw new Error(`Job ${job.status.id} did not generate uploadable images.`);
  }
  await assertCarouselReadyForUpload(pkg, images);

  if (dryRun) {
    return {
      jobId: job.status.id,
      jobDir: snapshot.dir,
      date: slotDate.toISOString(),
      integrationId,
      imageCount: images.length
    };
  }

  const baseUrl = process.env.POSTIZ_BASE_URL ?? DEFAULT_POSTIZ_BASE_URL;
  const apiKey = process.env.POSTIZ_API_KEY;
  if (!apiKey) {
    throw new Error("POSTIZ_API_KEY is missing from .env.local.");
  }

  const uploaded = [];
  for (const image of images) {
    uploaded.push(await uploadPostizImage(baseUrl, apiKey, image));
  }

  const postizResponse = await createPostizDraft({
    baseUrl,
    apiKey,
    integrationId,
    date: slotDate.toISOString(),
    caption,
    images: uploaded,
    type: process.env.POSTIZ_POST_TYPE === "schedule" ? "schedule" : "draft"
  });

  return {
    jobId: job.status.id,
    jobDir: snapshot.dir,
    date: slotDate.toISOString(),
    integrationId,
    imageCount: uploaded.length,
    postizResponse
  };
}

async function main(): Promise<void> {
  loadLocalEnv();
  const { dryRun, count } = parseArgs();
  const baseUrl = process.env.POSTIZ_BASE_URL ?? DEFAULT_POSTIZ_BASE_URL;
  const profile = process.env.POSTIZ_TIKTOK_PROFILE ?? DEFAULT_TIKTOK_PROFILE;
  const slots = (process.env.POSTIZ_DAILY_SLOTS?.split(",") ?? DEFAULT_SLOTS).map((slot) => slot.trim()).filter(Boolean);
  const apiKey = process.env.POSTIZ_API_KEY;
  const results: DraftResult[] = [];

  let integrationId = "dry-run";
  if (!dryRun) {
    if (!apiKey) {
      throw new Error("POSTIZ_API_KEY is missing from .env.local.");
    }
    const integrations = await listPostizIntegrations(baseUrl, apiKey as string);
    integrationId = findTikTokIntegration(integrations, profile).id;
  }

  for (let index = 0; index < count; index += 1) {
    const slot = slots[index % slots.length] ?? DEFAULT_SLOTS[index % DEFAULT_SLOTS.length];
    results.push(await buildOneDraft(nextSlotDate(slot, index), integrationId, dryRun, index));
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        postType: process.env.POSTIZ_POST_TYPE === "schedule" ? "schedule" : "draft",
        profile,
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
