import type { GeneratedPackage } from "@/lib/types";

function numbered(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatCaptionPackage(pkg: GeneratedPackage): string {
  return `# ${pkg.title}

Main caption:
${pkg.mainCaption}

Alternate hooks:
${numbered(pkg.alternateHooks)}

Slide text:
${numbered(pkg.slideText)}

Hashtags:
${pkg.hashtags.join(" ")}

Posting notes:
${bullets(pkg.postingNotes)}
`;
}
