import { NextResponse } from "next/server";
import { readJobTextArtifact } from "@/lib/jobs/store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const captions = await readJobTextArtifact(id, "captions.txt");
    return new NextResponse(captions, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${id}-captions.txt"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Captions not found." }, { status: 404 });
  }
}
