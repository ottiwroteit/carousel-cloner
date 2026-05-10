import { NextResponse } from "next/server";
import { acceptCurrentSlot, getOrCreateReviewState, rejectCurrentSlot, saveReviewState } from "@/lib/review/state";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json(await getOrCreateReviewState(id));
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { action?: "accept" | "reject" };
  const state = await getOrCreateReviewState(id);

  if (body.action === "accept") {
    const next = acceptCurrentSlot(state);
    await saveReviewState(next);
    return NextResponse.json(next);
  }

  if (body.action === "reject") {
    const next = rejectCurrentSlot(state);
    await saveReviewState(next);
    return NextResponse.json(next);
  }

  return NextResponse.json({ error: "Unknown review action." }, { status: 400 });
}
