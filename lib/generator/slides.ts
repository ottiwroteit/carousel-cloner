import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GeneratedPackage, StyleProfile } from "@/lib/types";

type RenderSlideOptions = {
  index: number;
  total: number;
  title: string;
  profile: StyleProfile;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapWords(text: string, maxChars = 18): string[] {
  const words = text.split(/\s+/);
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

  return lines.slice(0, 6);
}

export function renderSlideSvg({ index, total, title, profile }: RenderSlideOptions): string {
  const lines = wrapWords(title);
  const lineMarkup = lines
    .map((line, lineIndex) => `<text x="84" y="${430 + lineIndex * 82}" class="headline">${escapeXml(line)}</text>`)
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <title>${escapeXml(title)}</title>
  <style>
    .bg { fill: #080a0f; }
    .panel { fill: #10131a; stroke: #293040; stroke-width: 2; }
    .accent { fill: #40d6a3; }
    .blue { fill: #7aa7ff; }
    .muted { fill: #9ca7ba; font-family: Inter, Arial, sans-serif; font-size: 34px; font-weight: 700; }
    .headline { fill: #f5f7fb; font-family: Inter, Arial, sans-serif; font-size: 72px; font-weight: 900; letter-spacing: 0; }
    .small { fill: #9ca7ba; font-family: Inter, Arial, sans-serif; font-size: 28px; font-weight: 700; }
  </style>
  <rect width="1080" height="1350" class="bg"/>
  <rect x="48" y="48" width="984" height="1254" rx="38" class="panel"/>
  <circle cx="900" cy="180" r="42" class="accent"/>
  <circle cx="820" cy="180" r="18" class="blue"/>
  <rect x="84" y="132" width="380" height="18" rx="9" class="accent"/>
  <text x="84" y="218" class="muted">Slide ${index}/${total}</text>
  ${lineMarkup}
  <rect x="84" y="1030" width="912" height="132" rx="28" fill="#151924" stroke="#293040" stroke-width="2"/>
  <text x="122" y="1090" class="small">${escapeXml(profile.tone)}</text>
  <text x="122" y="1138" class="small">${escapeXml(profile.imageStyle)}</text>
</svg>
`;
}

export async function generateSlideImages(jobDir: string, pkg: GeneratedPackage, profile: StyleProfile): Promise<string[]> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });

  const paths: string[] = [];
  for (const [index, title] of pkg.slideText.entries()) {
    const filename = `slide-${String(index + 1).padStart(2, "0")}.svg`;
    const relativePath = path.join("generated", filename);
    await writeFile(
      path.join(jobDir, relativePath),
      renderSlideSvg({
        index: index + 1,
        total: pkg.slideText.length,
        title,
        profile
      }),
      "utf8"
    );
    paths.push(relativePath);
  }

  return paths;
}
