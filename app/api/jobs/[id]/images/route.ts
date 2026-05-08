import JSZip from "jszip";
import { NextResponse } from "next/server";
import { readJob, readJobFile } from "@/lib/jobs/store";
import type { GeneratedPackage } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const job = await readJob(id);
    const pkg = job.artifacts["package.json"] as GeneratedPackage | undefined;
    const images = pkg?.generatedImages ?? [];
    const zip = new JSZip();

    for (const image of images) {
      zip.file(image.split("/").at(-1) ?? image, await readJobFile(id, image));
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${id}-carousel-images.zip"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Images not found." }, { status: 404 });
  }
}
