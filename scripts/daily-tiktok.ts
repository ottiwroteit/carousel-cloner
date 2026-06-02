import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { formatCaptionPackage } from "../lib/export/captions";
import { completeCarouselImages } from "../lib/generator/complete-carousel-images";
import { processJob } from "../lib/generator/pipeline";
import { createJob, writeJobArtifact, writeJobTextArtifact } from "../lib/jobs/store";
import {
  createPostizDraft,
  listPostizIntegrations,
  listPostizPosts,
  uploadPostizImage,
  type PostizIntegration,
  type PostizPostSummary
} from "../lib/postiz/client";
import type { GeneratedPackage, StyleProfile } from "../lib/types";

type PlatformDraft = {
  platform: string;
  integrationId: string;
  postId?: string;
  response?: unknown;
};

type DraftResult = {
  jobId: string;
  jobDir: string;
  date: string;
  imageCount: number;
  platforms: PlatformDraft[];
};

const DEFAULT_POSTIZ_BASE_URL = "http://localhost:4007/api/public/v1";
const DEFAULT_TIKTOK_PROFILE = "downloadbare";
const DEFAULT_SLOTS = ["12:30", "15:00", "18:00"];
const STOREFRONT_STORES = ["Target", "Whole Foods", "Walmart", "Sprouts", "Kroger", "Publix", "H-E-B"];
const MIN_POST_GAP_MS = 3 * 60 * 60 * 1000;

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

function parseArgs(): { dryRun: boolean; count: number; startDate?: string; offset: number } {
  const args = new Set(process.argv.slice(2));
  const countArg = process.argv.find((arg) => arg.startsWith("--count="));
  const startArg = process.argv.find((arg) => arg.startsWith("--start="));
  const offsetArg = process.argv.find((arg) => arg.startsWith("--offset="));
  const count = countArg ? Number(countArg.split("=")[1]) : 3;
  const offset = offsetArg ? Number(offsetArg.split("=")[1]) : 0;
  return {
    dryRun: args.has("--dry-run"),
    count: Number.isFinite(count) && count > 0 ? count : 3,
    startDate: startArg?.split("=")[1],
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0
  };
}

function nextSlotDate(slot: string, index: number, slotsPerDay: number, startDate?: string): Date {
  const [hour = "9", minute = "0"] = slot.split(":");
  const date = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
  date.setDate(date.getDate() + Math.floor(index / slotsPerDay));
  date.setHours(Number(hour), Number(minute), 0, 0);
  if (!startDate && date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }
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

function findIntegration(integrations: PostizIntegration[], identifier: string, profile: string): PostizIntegration {
  const match = integrations.find(
    (integration) =>
      (integration.identifier ?? "").toLowerCase() === identifier.toLowerCase() &&
      [integration.profile, integration.name].filter(Boolean).some((value) => value?.toLowerCase() === profile.toLowerCase())
  );

  if (!match) {
    const available = integrations
      .filter((integration) => (integration.identifier ?? "").toLowerCase() === identifier.toLowerCase())
      .map((integration) => integration.profile ?? integration.name ?? integration.id)
      .join(", ");
    throw new Error(`${identifier} integration "${profile}" was not found in Postiz. Available ${identifier} profiles: ${available || "none"}.`);
  }

  return match;
}

function findOptionalInstagramIntegration(integrations: PostizIntegration[], profile: string): PostizIntegration | undefined {
  return integrations.find((integration) => {
    const identifier = (integration.identifier ?? "").toLowerCase();
    if (!identifier.includes("instagram")) {
      return false;
    }
    return [integration.profile, integration.name].filter(Boolean).some((value) => value?.toLowerCase() === profile.toLowerCase());
  });
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

function assertAllowedProducts(pkg: GeneratedPackage): void {
  const bannedTerms = [/\bozarka\b/i, /\bolive\s+oil\b/i, /\bliquid\s+death\b/i, /\bsnapple\b/i];
  const malformedTerms = [/^(meal|food|sauce|beverage|drink|snack|candy|cheese|water|chips|salt|sugar|oil)$/i];
  const unsafeTerms = [
    /\braw\b/i,
    /\bchicken\b/i,
    /\bbeef\b/i,
    /\bpork\b/i,
    /\bturkey\b/i,
    /\bmeat\b/i,
    /\bsausage\b/i,
    /\bpepperoni\b/i,
    /\bham\b/i,
    /\bprosciutto\b/i,
    /\bsalami\b/i,
    /\bhot\s+dog\b/i,
    /\bhotdog\b/i,
    /\bsalmon\b/i,
    /\btuna\b/i,
    /\bfish\b/i,
    /\bwhiting\b/i,
    /\bcod\b/i,
    /\btilapia\b/i,
    /\btrout\b/i,
    /\bhalibut\b/i,
    /\bcatfish\b/i,
    /\bsardines?\b/i,
    /\banchov(y|ies)\b/i,
    /\bshrimp\b/i,
    /\bcrab\b/i,
    /\blobster\b/i,
    /\bseafood\b/i,
    /\bfillets?\b/i,
    /\b(stick|sticks|jerky)\b/i,
    /\bpoultry\b/i,
    /\bbacon\b/i,
    /\bspam\b/i
  ];
  const seen = new Set<string>();

  for (const slide of pkg.carouselSlides ?? []) {
    if (!slide.productName || slide.kind !== "product-photo") {
      continue;
    }
    const key = `${slide.barcode ?? ""}:${slide.productName.toLowerCase()}`;
    if (seen.has(key)) {
      throw new Error(`Upload blocked: repeated product detected in package (${slide.productName}).`);
    }
    seen.add(key);

    const text = `${slide.productName} ${slide.bareSummary ?? ""}`;
    const productWords = slide.productName
      .replace(/[^a-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2);
    if (productWords.length < 2) {
      throw new Error(`Upload blocked: product name is too generic (${slide.productName}).`);
    }
    if (malformedTerms.some((term) => term.test(slide.productName.trim()))) {
      throw new Error(`Upload blocked: generic product name detected (${slide.productName}).`);
    }
    if (bannedTerms.some((term) => term.test(text))) {
      throw new Error(`Upload blocked: banned product detected (${slide.productName}).`);
    }
    if (unsafeTerms.some((term) => term.test(text))) {
      throw new Error(`Upload blocked: unsafe product detected (${slide.productName}).`);
    }
  }
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinGap(candidate: Date, existing: Date): boolean {
  return Math.abs(candidate.getTime() - existing.getTime()) < MIN_POST_GAP_MS;
}

function resolveDraftDate(candidate: Date, reservedDates: Date[]): Date {
  let scheduled = new Date(candidate);

  while (true) {
    const conflict = reservedDates.find((existing) => isWithinGap(scheduled, existing));
    if (!conflict) {
      return scheduled;
    }

    scheduled = new Date(conflict.getTime() + MIN_POST_GAP_MS);
  }
}

function collectReservedDates(posts: PostizPostSummary[], integrationIds: string[]): Date[] {
  const allowedIds = new Set(integrationIds);
  return posts
    .filter((post) => post.integrationIds.some((integrationId) => allowedIds.has(integrationId)))
    .map((post) => parseIsoDate(post.date))
    .filter((date): date is Date => Boolean(date));
}

function extractPostId(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractPostId(entry);
      if (nested) {
        return nested;
      }
    }
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["id", "_id", "postId"]) {
      if (typeof record[key] === "string" && record[key]) {
        return record[key] as string;
      }
    }
    for (const nestedKey of ["data", "post", "posts", "result"]) {
      const nested = extractPostId(record[nestedKey]);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

function readPackageProductBarcodes(packagePath: string): string[] {
  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as GeneratedPackage;
    return (pkg.carouselSlides ?? []).flatMap((slide) => (slide.barcode ? [slide.barcode] : []));
  } catch {
    return [];
  }
}

function collectHistoricalProductBarcodes(root = path.join(process.cwd(), "outputs", "jobs")): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const barcodes = new Set<string>();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packagePath = path.join(root, entry.name, "package.json");
    if (!existsSync(packagePath)) {
      continue;
    }

    for (const barcode of readPackageProductBarcodes(packagePath)) {
      barcodes.add(barcode);
    }
  }

  return [...barcodes];
}

async function buildOneDraft(
  slotDate: Date,
  integrations: PostizIntegration[],
  dryRun: boolean,
  index: number,
  excludeProductBarcodes: string[],
  retryRejectedBarcodes: string[] = []
): Promise<DraftResult> {
  const storeName = storeForDraft(index);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const job = await createJob({
      url: "https://www.tiktok.com/@downloadbare",
      profile: defaultProfile
    });

    try {
      const snapshot = await processJob(job.status.id, {
        useOpenAIImages: process.env.CAROUSEL_USE_OPENAI_IMAGES === "1",
        forceStorefrontHero: true,
        storeName,
        useStockHeroImages: true,
        useBareSimulatorScreenshots: true,
        requireBareSimulatorScreenshots: true,
        excludeProductBarcodes: [...excludeProductBarcodes, ...retryRejectedBarcodes]
      });
      const pkg = await finalizePackage(job.status.id, snapshot.dir, snapshot.artifacts["package.json"] as GeneratedPackage);
      const images = (pkg.generatedImages ?? []).map((relativePath) => path.join(snapshot.dir, relativePath));
      const caption = captionForPackage(pkg);

      if (images.length === 0) {
        throw new Error(`Job ${job.status.id} did not generate uploadable images.`);
      }
      await assertCarouselReadyForUpload(pkg, images);
      assertAllowedProducts(pkg);

      if (dryRun) {
        return {
          jobId: job.status.id,
          jobDir: snapshot.dir,
          date: slotDate.toISOString(),
          imageCount: images.length,
          platforms: integrations.map((integration) => ({
            platform: integration.identifier ?? integration.name ?? integration.id,
            integrationId: integration.id
          }))
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

      const platforms: PlatformDraft[] = [];
      for (const integration of integrations) {
        const response = await createPostizDraft({
          baseUrl,
          apiKey,
          integrationId: integration.id,
          integrationIdentifier: integration.identifier,
          date: slotDate.toISOString(),
          caption,
          images: uploaded,
          type: process.env.POSTIZ_POST_TYPE === "schedule" ? "schedule" : "draft"
        });
        platforms.push({
          platform: integration.identifier ?? integration.name ?? integration.id,
          integrationId: integration.id,
          postId: extractPostId(response),
          response
        });
      }

      return {
        jobId: job.status.id,
        jobDir: snapshot.dir,
        date: slotDate.toISOString(),
        imageCount: uploaded.length,
        platforms
      };
    } catch (error) {
      lastError = error;
      const selectionPath = path.join(job.dir, "bare-product-selection.json");
      if (existsSync(selectionPath)) {
        const selected = JSON.parse(readFileSync(selectionPath, "utf8")) as Array<{ barcode?: string; productName?: string }>;
        for (const product of selected) {
          if (product.barcode && !retryRejectedBarcodes.includes(product.barcode)) {
            retryRejectedBarcodes.push(product.barcode);
          }
        }
        const names = selected.map((product) => product.productName ?? product.barcode).filter(Boolean).join(", ");
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`Draft ${index + 1} attempt ${attempt} failed: ${reason}; retrying with replacement products. Rejected: ${names}`);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Draft ${index + 1} failed after replacement attempts.`);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const { dryRun, count, startDate, offset } = parseArgs();
  const baseUrl = process.env.POSTIZ_BASE_URL ?? DEFAULT_POSTIZ_BASE_URL;
  const profile = process.env.POSTIZ_TIKTOK_PROFILE ?? DEFAULT_TIKTOK_PROFILE;
  const slots = (process.env.POSTIZ_DAILY_SLOTS?.split(",") ?? DEFAULT_SLOTS).map((slot) => slot.trim()).filter(Boolean);
  const apiKey = process.env.POSTIZ_API_KEY;
  const results: DraftResult[] = [];
  const usedProductBarcodes = new Set<string>(collectHistoricalProductBarcodes());
  const targetIntegrations: PostizIntegration[] = [];
  const reservedDates: Date[] = [];

  if (!apiKey) {
    throw new Error("POSTIZ_API_KEY is missing from .env.local.");
  }

  const integrations = await listPostizIntegrations(baseUrl, apiKey as string);
  const tiktokIntegration = findIntegration(integrations, "tiktok", profile);
  targetIntegrations.push(tiktokIntegration);

  const instagramIntegration = findOptionalInstagramIntegration(integrations, profile);
  if (instagramIntegration) {
    targetIntegrations.push(instagramIntegration);
  }

  const existingPosts = await listPostizPosts(baseUrl, apiKey as string);
  reservedDates.push(...collectReservedDates(existingPosts, targetIntegrations.map((integration) => integration.id)));

  if (dryRun) {
    reservedDates.push(new Date());
  }

  for (let index = 0; index < count; index += 1) {
    const scheduleIndex = index + offset;
    const slot = slots[scheduleIndex % slots.length] ?? DEFAULT_SLOTS[scheduleIndex % DEFAULT_SLOTS.length];
    const slotDate = resolveDraftDate(nextSlotDate(slot, scheduleIndex, slots.length, startDate), reservedDates);
    const result = await buildOneDraft(
      slotDate,
      targetIntegrations,
      dryRun,
      scheduleIndex,
      [...usedProductBarcodes]
    );
    results.push(result);
    reservedDates.push(new Date(result.date));
    const pkg = JSON.parse(readFileSync(path.join(result.jobDir, "package.json"), "utf8")) as GeneratedPackage;
    for (const barcode of (pkg.carouselSlides ?? []).flatMap((slide) => (slide.barcode ? [slide.barcode] : []))) {
      usedProductBarcodes.add(barcode);
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        postType: process.env.POSTIZ_POST_TYPE === "schedule" ? "schedule" : "draft",
        profile,
        integrations: targetIntegrations.map((integration) => ({
          id: integration.id,
          identifier: integration.identifier,
          profile: integration.profile,
          name: integration.name
        })),
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
