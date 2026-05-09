import { NextResponse } from "next/server";
import { processJob } from "@/lib/generator/pipeline";
import { createJob } from "@/lib/jobs/store";
import type { StyleProfile } from "@/lib/types";
import { validateTikTokUrl } from "@/lib/url";

const defaultProfile: StyleProfile = {
  accountName: "Carousel Cloner",
  targetAudience: "creators and operators",
  topics: ["automation", "content systems"],
  tone: "direct, useful, and specific",
  captionRules: "Write short paragraphs with one clear CTA.",
  imageStyle: "clean vertical carousel slides with crisp UI details",
  bannedElements: ["generic hype", "fake results"],
  ctaStyle: "soft practical question"
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<{ url: string; profile: StyleProfile }>;
    const validation = validateTikTokUrl(body.url ?? "");

    if (!validation.ok) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const job = await createJob({
      url: validation.url,
      profile: body.profile ?? defaultProfile
    });

    const snapshot = await processJob(job.status.id);

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
