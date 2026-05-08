import { NextResponse } from "next/server";
import { readJobFile } from "@/lib/jobs/store";

type RouteContext = {
  params: Promise<{ id: string; path: string[] }>;
};

function contentType(filename: string): string {
  if (filename.endsWith(".svg")) {
    return "image/svg+xml; charset=utf-8";
  }
  if (filename.endsWith(".png")) {
    return "image/png";
  }
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return "application/octet-stream";
}

export async function GET(_request: Request, context: RouteContext) {
  const { id, path } = await context.params;
  const relativePath = path.join("/");

  try {
    const file = await readJobFile(id, relativePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType(relativePath),
        "Content-Disposition": `inline; filename="${path.at(-1) ?? "image"}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
