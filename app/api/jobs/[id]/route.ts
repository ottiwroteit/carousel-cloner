import { NextResponse } from "next/server";
import { readJob } from "@/lib/jobs/store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    return NextResponse.json(await readJob(id));
  } catch {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
}
