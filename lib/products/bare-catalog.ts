import { readFile } from "node:fs/promises";
import path from "node:path";

export type BareProduct = {
  barcode: string;
  brand: string;
  productName: string;
  category: string;
  score: number | null;
  label: string;
  imageUrl: string;
  source: string;
  summary: string;
};

type CatalogOptions = {
  dataDir?: string;
  preferWithImages?: boolean;
};

const WITH_IMAGES_FILE = "bare_products_with_images.csv";
const ALL_SCANNABLE_FILE = "bare_products_all_scannable.csv";
const UNSAFE_SCREEN_TERMS = [
  /\braw\b/i,
  /\bchicken\s+(breast|thigh|tender|tenders|wing|wings|drumstick|cutlet|cutlets)\b/i,
  /\bground\s+(beef|chicken|turkey|pork)\b/i,
  /\b(steak|pork\s+chop|pork\s+chops|pork\s+belly)\b/i,
  /\bspam\b/i,
  /\bbacon\b/i
];

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function isMarketable(row: Record<string, string>): boolean {
  const name = row.product_name?.trim() ?? "";
  const brand = row.brand?.trim() ?? "";
  const barcode = row.barcode?.trim() ?? "";
  const imageUrl = row.image_url?.trim() ?? "";
  const screenText = `${name} ${row.category ?? ""} ${row.summary ?? ""}`;

  if (!barcode || !brand || !name || !imageUrl) {
    return false;
  }

  if (name === barcode || /^\d{8,}$/.test(name)) {
    return false;
  }

  if (brand.toLowerCase() === "unknown") {
    return false;
  }

  if (UNSAFE_SCREEN_TERMS.some((term) => term.test(screenText))) {
    return false;
  }

  return true;
}

function toProduct(row: Record<string, string>): BareProduct {
  return {
    barcode: row.barcode,
    brand: row.brand,
    productName: row.product_name,
    category: row.category,
    score: row.score ? Number(row.score) : null,
    label: row.label,
    imageUrl: row.image_url,
    source: row.source,
    summary: row.summary
  };
}

export async function readBareCatalog({
  dataDir = path.join(process.cwd(), "data"),
  preferWithImages = true
}: CatalogOptions = {}): Promise<BareProduct[]> {
  const filename = preferWithImages ? WITH_IMAGES_FILE : ALL_SCANNABLE_FILE;
  const filePath = path.join(dataDir, filename);
  const text = await readFile(filePath, "utf8");
  return parseCsv(text).filter(isMarketable).map(toProduct);
}

export function selectBareProducts(products: BareProduct[], count: number, random: () => number = Math.random): BareProduct[] {
  const eligible = products.filter((product) => product.imageUrl);
  const remaining = [...eligible];
  const selected: BareProduct[] = [];

  while (selected.length < count && remaining.length) {
    const index = Math.floor(random() * remaining.length) % remaining.length;
    selected.push(remaining[index]);
    remaining.splice(index, 1);
  }

  return selected;
}
