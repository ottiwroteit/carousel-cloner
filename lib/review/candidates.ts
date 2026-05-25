import { getJobDir } from "@/lib/jobs/store";
import { composeProductImage } from "@/lib/generator/compose-product-image";
import { generateOpenAIImages, getOpenAIImageConfig } from "@/lib/generator/openai-images";
import type { ReviewSlot } from "@/lib/review/state";

type GenerateReviewCandidateOptions = {
  jobId: string;
  slot: ReviewSlot;
  nextRejectCount: number;
  root?: string;
  generateOpenAIImages?: typeof generateOpenAIImages;
};

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "candidate";
}

function gptPrompt(slot: ReviewSlot): string {
  if (slot.kind === "storefront-hook") {
    return `Photorealistic vertical 9:16 smartphone hero photo for a TikTok grocery carousel. Use this exact public overlay text: "${slot.title}". Make it polished and post-ready, with natural light and a clean grocery shopping context. Do not include internal production labels, snake_case text, scene names, filenames, or the word "hook".`;
  }

  return `Create a polished vertical 9:16 product photoshoot-style grocery image for "${slot.productName}". The product should look premium, clean, centered, and brand-safe, with a realistic grocery, kitchen counter, picnic, or cookout background. Do not invent fake label text; keep product branding plausible and tasteful.`;
}

export async function generateReviewCandidate({
  jobId,
  slot,
  nextRejectCount,
  root,
  generateOpenAIImages: openAI = generateOpenAIImages
}: GenerateReviewCandidateOptions): Promise<string> {
  const jobDir = getJobDir(jobId, root);
  const name = `review-${String(slot.position).padStart(2, "0")}-${safeName(slot.productName ?? slot.title)}-${nextRejectCount}`;

  if (slot.kind === "product-photo" && slot.sourceImage && nextRejectCount < 3) {
    return composeProductImage({
      jobDir,
      sourceRelativePath: slot.sourceImage,
      outputName: name,
      variant: nextRejectCount
    });
  }

  const [candidate] = await openAI({
    jobDir,
    prompts: [gptPrompt(slot)],
    outputNames: [`${name}-gpt`],
    config: {
      ...getOpenAIImageConfig(),
      model: "gpt-image-1",
      quality: "high",
      enabled: true
    }
  });

  return candidate;
}
