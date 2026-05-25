import { NextResponse } from "next/server";
import { generateReviewCandidate } from "@/lib/review/candidates";
import { applyAcceptedSlotToPackage } from "@/lib/review/package-sync";
import { acceptCurrentSlot, editSlot, getOrCreateReviewState, rejectCurrentSlot, saveReviewState } from "@/lib/review/state";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json(await getOrCreateReviewState(id));
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { action?: "accept" | "reject" | "edit"; position?: number };
  const state = await getOrCreateReviewState(id);

  if (body.action === "edit" && typeof body.position === "number") {
    const next = editSlot(state, body.position);
    await saveReviewState(next);
    return NextResponse.json(next);
  }

  if (body.action === "accept") {
    const next = acceptCurrentSlot(state);
    const acceptedSlot = next.slots[state.currentIndex];
    if (acceptedSlot?.acceptedImage) {
      await applyAcceptedSlotToPackage(id, acceptedSlot);
    }
    await saveReviewState(next);
    return NextResponse.json(next);
  }

  if (body.action === "reject") {
    const slot = state.slots[state.currentIndex];
    const candidate = slot
      ? await generateReviewCandidate({
          jobId: id,
          slot,
          nextRejectCount: slot.rejectCount + 1
        })
      : undefined;
    const next = rejectCurrentSlot(state, candidate);
    await saveReviewState(next);
    return NextResponse.json(next);
  }

  return NextResponse.json({ error: "Unknown review action." }, { status: 400 });
}
