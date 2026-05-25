import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import sharp from "sharp";
import { composeProductImage } from "@/lib/generator/compose-product-image";

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

async function blackPixelSpan(filePath: string): Promise<number> {
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let maxX = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (r < 20 && g < 20 && b < 20) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }

  return maxX - minX + 1;
}

describe("composeProductImage", () => {
  test("trims padded source images and scales the actual product across the slide", async () => {
    root = await mkdtemp(path.join(tmpdir(), "compose-product-image-"));
    const jobDir = path.join(root, "job");
    await mkdir(path.join(jobDir, "generated"), { recursive: true });

    await writeFile(
      path.join(jobDir, "generated", "wide-source.png"),
      await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 4,
          background: "#ffffff"
        }
      })
        .composite([
          {
            input: Buffer.from('<svg width="400" height="80"><rect width="400" height="80" fill="#000000"/></svg>'),
            left: 0,
            top: 160
          }
        ])
        .png()
        .toBuffer()
    );

    const relativePath = await composeProductImage({
      jobDir,
      sourceRelativePath: "generated/wide-source.png",
      outputName: "composed",
      variant: 0
    });

    const outputPath = path.join(jobDir, relativePath);
    const meta = await sharp(await readFile(outputPath)).metadata();

    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
    await expect(blackPixelSpan(outputPath)).resolves.toBeGreaterThan(900);
  });
});
