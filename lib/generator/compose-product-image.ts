import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type ComposeProductImageOptions = {
  jobDir: string;
  sourceRelativePath: string;
  outputName: string;
  variant: number;
};

const WIDTH = 1080;
const HEIGHT = 1920;
const CUPBOARD_BACKGROUND_PATH = "/Users/otti/Documents/otti-coded-team/Apps/BARE/assets/infinite-empty-cupboard.png";

const BACKGROUNDS = [
  { top: "#f7f8ef", bottom: "#dfeee5" },
  { top: "#f6f0e7", bottom: "#e4edf5" },
  { top: "#eef5ee", bottom: "#f5e5df" }
];

function backgroundSvg(variant: number): Buffer {
  const colors = BACKGROUNDS[variant % BACKGROUNDS.length];
  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.top}"/>
      <stop offset="100%" stop-color="${colors.bottom}"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="24"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <ellipse cx="850" cy="340" rx="360" ry="190" fill="#ffffff" opacity="0.55" filter="url(#soft)"/>
  <ellipse cx="230" cy="1460" rx="410" ry="230" fill="#cfe7dd" opacity="0.55" filter="url(#soft)"/>
  <rect x="0" y="1320" width="1080" height="600" fill="#efe6db" opacity="0.46"/>
</svg>`);
}

async function trimProduct(source: Buffer): Promise<Buffer> {
  try {
    return await sharp(source)
      .rotate()
      .trim({
        background: "#ffffff",
        threshold: 24
      })
      .png()
      .toBuffer();
  } catch {
    return sharp(source).rotate().png().toBuffer();
  }
}

async function productBackground(variant: number): Promise<Buffer> {
  try {
    return await sharp(await readFile(CUPBOARD_BACKGROUND_PATH))
      .resize({
        width: WIDTH,
        height: HEIGHT,
        fit: "cover"
      })
      .png()
      .toBuffer();
  } catch {
    return backgroundSvg(variant);
  }
}

export async function composeProductImage({
  jobDir,
  sourceRelativePath,
  outputName,
  variant
}: ComposeProductImageOptions): Promise<string> {
  const sourcePath = path.join(jobDir, sourceRelativePath);
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });
  const source = await readFile(sourcePath);
  const trimmed = await trimProduct(source);

  const product = await sharp(trimmed)
    .resize({
      width: 980,
      height: 1040,
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toBuffer();

  const productMeta = await sharp(product).metadata();
  const productWidth = productMeta.width ?? 720;
  const productHeight = productMeta.height ?? 920;
  const left = Math.round((WIDTH - productWidth) / 2);
  const top = productHeight < 420 ? 760 : Math.round((HEIGHT - productHeight) / 2) + 48;

  const shadow = Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${WIDTH / 2}" cy="${top + productHeight + 36}" rx="${Math.max(220, productWidth * 0.38)}" ry="30" fill="#111827" opacity="0.10"/>
  </svg>`);

  const composed = await sharp(await productBackground(variant))
    .composite([
      { input: shadow, left: 0, top: 0 },
      { input: product, left, top }
    ])
    .png()
    .toBuffer();

  const filename = `${outputName}.png`;
  const relativePath = path.join("generated", filename);
  await writeFile(path.join(jobDir, relativePath), composed);
  return relativePath;
}
