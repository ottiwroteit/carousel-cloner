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

type SelectBareProductsOptions = {
  storeName?: string;
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
const REJECTED_ROTATION_TERMS = [
  /\bozarka\b/i,
  /\bolive\s+oil+l*\b/i,
  /\bliquid\s+death\b/i,
  /\bsnapple\b/i
];
const MALFORMED_PRODUCT_NAME_TERMS = [
  /\bunidades\b/i,
  /\bundefined\b/i,
  /\bnull\b/i,
  /\([^)]{0,2}\)/,
  /[a-z]\(/i
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
  const screenText = `${brand} ${name} ${row.category ?? ""} ${row.summary ?? ""}`;

  if (!barcode || !brand || !name || !imageUrl || /^null$/i.test(imageUrl)) {
    return false;
  }

  if (name === barcode || /^\d{8,}$/.test(name)) {
    return false;
  }

  if (brand.toLowerCase() === "unknown") {
    return false;
  }

  if (MALFORMED_PRODUCT_NAME_TERMS.some((term) => term.test(name))) {
    return false;
  }

  if (UNSAFE_SCREEN_TERMS.some((term) => term.test(screenText))) {
    return false;
  }

  if (REJECTED_ROTATION_TERMS.some((term) => term.test(screenText))) {
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

const STORE_PRIVATE_LABELS: Array<{ pattern: RegExp; stores: RegExp[] }> = [
  { pattern: /\btrader joe'?s\b/i, stores: [/trader joe/i] },
  { pattern: /\b(kroger|simple truth|private selection)\b/i, stores: [/kroger/i] },
  { pattern: /\b(publix|greenwise)\b/i, stores: [/publix/i] },
  { pattern: /\b(h-?e-?b|central market)\b/i, stores: [/h-?e-?b/i] },
  { pattern: /\bsprouts\b/i, stores: [/sprouts/i] },
  { pattern: /\b(good\s*&\s*gather|market pantry|favorite day)\b/i, stores: [/target/i] },
  { pattern: /\b(kirkland|costco)\b/i, stores: [/costco/i] },
  { pattern: /\b(365|whole foods)\b/i, stores: [/whole foods/i] },
  { pattern: /\b(signature select|open nature|o organics|jewel-osco)\b/i, stores: [/jewel/i, /osco/i, /albertsons/i] }
];

function matchesSelectedStore(product: BareProduct, storeName?: string): boolean {
  if (!storeName) {
    return true;
  }

  const brandAndName = `${product.brand} ${product.productName}`;
  const privateLabel = STORE_PRIVATE_LABELS.find((entry) => entry.pattern.test(brandAndName));
  if (!privateLabel) {
    return true;
  }

  return privateLabel.stores.some((storePattern) => storePattern.test(storeName));
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

export function selectBareProducts(
  products: BareProduct[],
  count: number,
  random: () => number = Math.random,
  options: SelectBareProductsOptions = {}
): BareProduct[] {
  const preferred = products.filter(
    (product) =>
      product.imageUrl &&
      typeof product.score === "number" &&
      product.score >= 90 &&
      /excellent/i.test(product.label) &&
      matchesSelectedStore(product, options.storeName)
  );
  const fallback = products.filter((product) => product.imageUrl && matchesSelectedStore(product, options.storeName));
  const eligible = preferred.length >= count ? preferred : fallback;
  const remaining = [...eligible];
  const selected: BareProduct[] = [];

  while (selected.length < count && remaining.length) {
    const index = Math.floor(random() * remaining.length) % remaining.length;
    selected.push(remaining[index]);
    remaining.splice(index, 1);
  }

  return selected;
}
