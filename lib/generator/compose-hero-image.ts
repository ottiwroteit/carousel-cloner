import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type ComposeHeroImageOptions = {
  jobDir: string;
  sourceRelativePath: string;
  outputName: string;
  title: string;
};

const WIDTH = 1080;
const HEIGHT = 1920;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapWords(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
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
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function overlaySvg(title: string): Buffer {
  const lines = wrapWords(title, title.length > 34 ? 14 : 16).slice(0, 5);
  const fontSize = lines.length >= 4 ? 74 : lines.length === 3 ? 82 : 92;
  const lineHeight = Math.round(fontSize * 1.08);
  const yStart = Math.round((HEIGHT - lines.length * lineHeight) / 2) - 80;
  const text = lines
    .map((line, index) => `<text x="${WIDTH / 2}" y="${yStart + index * lineHeight}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("\n");

  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text {
      fill: #fff;
      font-family: Impact, Arial Black, Arial, sans-serif;
      font-size: ${fontSize}px;
      font-weight: 900;
      paint-order: stroke;
      stroke: rgba(0,0,0,0.52);
      stroke-width: 10px;
      stroke-linejoin: round;
    }
  </style>
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.18)"/>
  ${text}
</svg>`);
}

export async function composeHeroImage({ jobDir, sourceRelativePath, outputName, title }: ComposeHeroImageOptions): Promise<string> {
  const sourcePath = path.join(jobDir, sourceRelativePath);
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });
  const source = sharp(await readFile(sourcePath)).rotate();
  const metadata = await source.metadata();
  const sourceWidth = metadata.width ?? WIDTH;
  const sourceHeight = metadata.height ?? HEIGHT;
  const cropTop = sourceHeight > sourceWidth ? Math.round(sourceHeight * 0.52) : 0;
  const cropHeight = sourceHeight - cropTop;

  const background = await sharp(await readFile(sourcePath))
    .rotate()
    .extract({ left: 0, top: cropTop, width: sourceWidth, height: cropHeight })
    .resize({ width: WIDTH, height: HEIGHT, fit: "cover" })
    .modulate({ brightness: 0.82, saturation: 0.92 })
    .png()
    .toBuffer();

  const composed = await sharp(background)
    .composite([{ input: overlaySvg(title), left: 0, top: 0 }])
    .png()
    .toBuffer();

  const relativePath = path.join("generated", `${outputName}.png`);
  await writeFile(path.join(jobDir, relativePath), composed);
  return relativePath;
}
