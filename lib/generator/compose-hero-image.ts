import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type ComposeHeroImageOptions = {
  jobDir: string;
  sourceRelativePath: string;
  outputName: string;
  title: string;
};

type ComposeLocalHeroImageOptions = {
  jobDir: string;
  outputName: string;
  title: string;
  storeName?: string;
  variant?: number;
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

function localHeroLines(title: string): string[] {
  const lines = wrapWords(title, title.length > 36 ? 14 : 15);
  if (lines.length <= 4) {
    return lines;
  }

  return wrapWords(title, 16).slice(0, 4);
}

function localHeroOverlay(title: string): string {
  const lines = localHeroLines(title);
  const fontSize = lines.length >= 4 ? 70 : lines.length === 3 ? 82 : 92;
  const lineHeight = Math.round(fontSize * 1.05);
  const textHeight = lines.length * lineHeight;
  const boxWidth = 850;
  const boxHeight = textHeight + 84;
  const boxX = Math.round((WIDTH - boxWidth) / 2);
  const boxY = 220;
  const textY = boxY + 74;
  const text = lines
    .map(
      (line, index) =>
        `<text x="${WIDTH / 2}" y="${textY + index * lineHeight}" text-anchor="middle" font-size="${fontSize}">${escapeXml(line)}</text>`
    )
    .join("\n");

  return `<g>
    <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="28" fill="#ffffff" opacity="0.94"/>
    ${text}
  </g>`;
}

function shelfItems(y: number, side: "left" | "right", variant: number): string {
  const xStart = side === "left" ? 0 : 670;
  const colors = ["#f2c14e", "#d96c4f", "#69a56f", "#4d7ea8", "#ece0c8", "#c94f7c"];
  return Array.from({ length: 18 })
    .map((_, index) => {
      const x = xStart + 18 + (index % 6) * 54;
      const row = Math.floor(index / 6);
      const color = colors[(index + variant + row) % colors.length];
      const height = 76 + ((index + variant) % 4) * 16;
      return `<rect x="${x}" y="${y + row * 126 - height}" width="40" height="${height}" rx="6" fill="${color}" opacity="0.82"/>`;
    })
    .join("");
}

function localHeroScene(title: string, storeName?: string, variant = 0): Buffer {
  const storefront = Boolean(storeName && title.toLowerCase().includes(storeName.toLowerCase()));
  const sign = storeName ? escapeXml(storeName.toUpperCase()) : "GROCERY";
  const scene = storefront
    ? `<rect width="${WIDTH}" height="${HEIGHT}" fill="#dce8ee"/>
      <rect x="0" y="0" width="${WIDTH}" height="760" fill="#b9d3df"/>
      <path d="M0 710 C180 650 330 680 510 620 C700 560 900 610 1080 548 L1080 0 L0 0 Z" fill="#e9f2f5" opacity="0.74"/>
      <rect x="-80" y="760" width="1240" height="790" fill="#f4f0e8"/>
      <rect x="80" y="865" width="920" height="190" rx="18" fill="#e5ddd0"/>
      <text x="540" y="990" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="92" font-weight="900" fill="#2c3742">${sign}</text>
      <rect x="90" y="1110" width="250" height="260" rx="118" fill="#202633"/>
      <rect x="415" y="1110" width="250" height="260" rx="118" fill="#202633"/>
      <rect x="740" y="1110" width="250" height="260" rx="118" fill="#202633"/>
      <rect x="0" y="1510" width="${WIDTH}" height="410" fill="#42523e"/>
      <path d="M0 1610 C210 1515 350 1585 520 1520 C720 1440 910 1505 1080 1450 L1080 1920 L0 1920 Z" fill="#304232"/>`
    : `<rect width="${WIDTH}" height="${HEIGHT}" fill="#d8d0c2"/>
      <rect x="380" y="0" width="320" height="${HEIGHT}" fill="#d7cbb8"/>
      <path d="M0 0 L380 0 L250 1920 L0 1920 Z" fill="#a48c69" opacity="0.38"/>
      <path d="M1080 0 L700 0 L830 1920 L1080 1920 Z" fill="#8f936b" opacity="0.36"/>
      <rect x="0" y="250" width="370" height="32" fill="#74614d"/>
      <rect x="710" y="250" width="370" height="32" fill="#626a4b"/>
      <rect x="0" y="570" width="330" height="34" fill="#74614d"/>
      <rect x="750" y="570" width="330" height="34" fill="#626a4b"/>
      <rect x="0" y="900" width="300" height="34" fill="#74614d"/>
      <rect x="780" y="900" width="300" height="34" fill="#626a4b"/>
      ${shelfItems(250, "left", variant)}
      ${shelfItems(250, "right", variant + 2)}
      ${shelfItems(570, "left", variant + 4)}
      ${shelfItems(570, "right", variant + 6)}
      ${shelfItems(900, "left", variant + 8)}
      ${shelfItems(900, "right", variant + 10)}
      <path d="M210 1470 L870 1470 L790 1860 L290 1860 Z" fill="none" stroke="#687078" stroke-width="18"/>
      <path d="M260 1530 L820 1530" stroke="#687078" stroke-width="12"/>
      <path d="M310 1600 L770 1600" stroke="#687078" stroke-width="10"/>
      <path d="M220 1405 L860 1405" stroke="#1e7d59" stroke-width="34" stroke-linecap="round"/>`;

  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="soften"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity="0.28"/></filter>
  </defs>
  <g filter="url(#soften)">${scene}</g>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000000" opacity="0.08"/>
  <g filter="url(#shadow)">
    ${localHeroOverlay(title)}
  </g>
  <style>
    text {
      fill: #111111;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 900;
      letter-spacing: 0;
    }
  </style>
</svg>`);
}

function overlaySvg(title: string): Buffer {
  const lines = wrapWords(title, title.length > 26 ? 11 : 13).slice(0, 5);
  const fontSize = lines.length >= 4 ? 62 : lines.length === 3 ? 70 : 76;
  const lineHeight = Math.round(fontSize * 1.06);
  const textHeight = lines.length * lineHeight;
  const stickerWidth = 820;
  const stickerHeight = textHeight + 70;
  const stickerX = Math.round((WIDTH - stickerWidth) / 2);
  const stickerY = 220;
  const yStart = stickerY + 76;
  const text = lines
    .map((line, index) => `<text x="${WIDTH / 2}" y="${yStart + index * lineHeight}" text-anchor="middle">${escapeXml(line)}</text>`)
    .join("\n");

  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text {
      fill: #111111;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: ${fontSize}px;
      font-weight: 900;
      letter-spacing: 0;
    }
  </style>
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.06)"/>
  <rect x="${stickerX}" y="${stickerY}" width="${stickerWidth}" height="${stickerHeight}" rx="24" fill="#ffffff" opacity="0.94"/>
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
  const cropTop = sourceHeight > sourceWidth * 1.1 ? 0 : sourceHeight > sourceWidth ? Math.round(sourceHeight * 0.34) : 0;
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

export async function composeLocalHeroImage({
  jobDir,
  outputName,
  title,
  storeName,
  variant = 0
}: ComposeLocalHeroImageOptions): Promise<string> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });

  const composed = await sharp(localHeroScene(title, storeName, variant)).png().toBuffer();
  const relativePath = path.join("generated", `${outputName}.png`);
  await writeFile(path.join(jobDir, relativePath), composed);
  return relativePath;
}
