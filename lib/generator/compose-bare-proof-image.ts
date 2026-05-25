import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { CarouselSlidePlan } from "@/lib/types";

type ComposeBareProofImageOptions = {
  jobDir: string;
  slide: CarouselSlidePlan;
  sourceRelativePath?: string;
  outputName: string;
};

const WIDTH = 1080;
const HEIGHT = 1920;
const GREEN = "#169643";
const LIGHT_GREEN = "#e9f7eb";
const TEXT = "#171914";
const MUTED = "#6e7168";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function wrapText(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines;
}

function textLines(lines: string[], x: number, y: number, size: number, color = TEXT, weight = 500): string {
  const dy = Math.round(size * 1.34);
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * dy}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`
    )
    .join("");
}

function proofSvg(slide: CarouselSlidePlan): Buffer {
  const productName = slide.productName ?? slide.title;
  const titleLines = wrapText(productName, 24, 3);
  const summary = slide.bareSummary?.trim()
    ? slide.bareSummary.trim()
    : `${productName} is included in the BARE catalog so shoppers can compare the ingredient quality before buying.`;
  const summaryLines = wrapText(summary, 42, 9);
  const score = typeof slide.bareScore === "number" ? `${slide.bareScore}/100` : "BARE score";
  const label = slide.bareLabel || "Scanned in BARE";

  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fbfbf6"/>
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#f7fbf3"/>
  <rect x="68" y="88" width="944" height="328" rx="44" fill="#ffffff"/>
  <rect x="68" y="480" width="944" height="188" rx="42" fill="${LIGHT_GREEN}" stroke="#9fd8aa" stroke-width="6"/>
  <text x="540" y="594" text-anchor="middle" font-size="46" font-weight="800" fill="#39764c">Add to Pantry</text>
  <rect x="68" y="744" width="944" height="860" rx="52" fill="#ffffff"/>
  <text x="204" y="850" font-size="54" font-weight="800" fill="${TEXT}">Olive's Analysis</text>
  <circle cx="144" cy="829" r="34" fill="#d9f2c9"/>
  <circle cx="134" cy="819" r="7" fill="#3c7b43"/>
  <circle cx="154" cy="819" r="7" fill="#3c7b43"/>
  <path d="M128 844 Q144 858 160 844" stroke="#3c7b43" stroke-width="6" fill="none" stroke-linecap="round"/>
  ${textLines(titleLines, 404, 156, 54, TEXT, 800)}
  <circle cx="408" cy="322" r="23" fill="${GREEN}"/>
  <text x="456" y="336" font-size="58" font-weight="700" fill="${TEXT}">${escapeXml(score)}</text>
  <text x="456" y="390" font-size="40" font-weight="500" fill="${MUTED}">${escapeXml(label)}</text>
  ${textLines(summaryLines, 116, 954, 42, "#585b54", 500)}
</svg>`);
}

async function productImage(source?: Buffer): Promise<Buffer | undefined> {
  if (!source) {
    return undefined;
  }

  try {
    return await sharp(source)
      .rotate()
      .trim({ background: "#ffffff", threshold: 18 })
      .resize({ width: 280, height: 250, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
  } catch {
    return sharp(source).rotate().resize({ width: 280, height: 250, fit: "inside" }).png().toBuffer();
  }
}

export async function composeBareProofImage({
  jobDir,
  slide,
  sourceRelativePath,
  outputName
}: ComposeBareProofImageOptions): Promise<string> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });

  const source = sourceRelativePath ? await readFile(path.join(jobDir, sourceRelativePath)).catch(() => undefined) : undefined;
  const product = await productImage(source);
  const composites = product ? [{ input: product, left: 104, top: 126 }] : [];

  const output = await sharp(proofSvg(slide)).composite(composites).png().toBuffer();
  const relativePath = path.join("generated", `${outputName}.png`);
  await writeFile(path.join(jobDir, relativePath), output);
  return relativePath;
}
