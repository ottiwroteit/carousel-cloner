import { execFile } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

type CaptureBareProductScreenshotOptions = {
  jobDir: string;
  barcode: string;
  outputName: string;
  productName?: string;
  simulatorId?: string;
  bundleId?: string;
};

export type BareHistoryProduct = {
  productName: string;
  brand: string;
  score: number | null;
};

type AxeNode = {
  AXLabel?: string | null;
  frame?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: AxeNode[];
  type?: string;
};

const execFileAsync = promisify(execFile);
const DEFAULT_SIMULATOR_ID = "booted";
const AXE_CANDIDATES = [
  process.env.AXE_PATH,
  "/Users/otti/.npm/_npx/99336612077b7094/node_modules/xcodebuildmcp/bundled/axe",
  "/Users/otti/Library/Developer/XcodeBuildMCP/axe"
].filter(Boolean) as string[];

async function run(command: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 10
  });
  return stdout;
}

async function screenshot(simulatorId: string, outputPath: string): Promise<void> {
  await run("xcrun", ["simctl", "io", simulatorId, "screenshot", outputPath]);
}

async function findAxePath(): Promise<string> {
  for (const candidate of AXE_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep checking candidates.
    }
  }

  throw new Error("Cannot capture BARE screenshot: AXe simulator automation binary was not found.");
}

async function resolveSimulatorUdid(simulatorId: string): Promise<string> {
  if (simulatorId !== "booted") {
    return simulatorId;
  }

  const json = JSON.parse(await run("xcrun", ["simctl", "list", "devices", "booted", "-j"])) as {
    devices?: Record<string, Array<{ udid: string; state: string }>>;
  };
  const booted = Object.values(json.devices ?? {})
    .flat()
    .find((device) => device.state === "Booted");

  if (!booted?.udid) {
    throw new Error("Cannot capture BARE screenshot: no booted simulator was found.");
  }

  return booted.udid;
}

async function axeTap(axePath: string, udid: string, x: number, y: number, postDelay = 0.35, tapStyle = "simulator"): Promise<void> {
  await run(axePath, [
    "tap",
    "-x",
    String(x),
    "-y",
    String(y),
    "--udid",
    udid,
    "--tap-style",
    tapStyle,
    "--post-delay",
    String(postDelay)
  ]);
}

async function axeTapLabel(axePath: string, udid: string, label: string, postDelay = 0.8): Promise<void> {
  await run(axePath, [
    "tap",
    "--label",
    label,
    "--udid",
    udid,
    "--tap-style",
    "simulator",
    "--wait-timeout",
    "4",
    "--post-delay",
    String(postDelay)
  ]);
}

async function axeType(axePath: string, udid: string, text: string): Promise<void> {
  await run(axePath, ["type", text, "--udid", udid]);
}

async function typeBarcodeIntoFocusedField(barcode: string): Promise<void> {
  const safeBarcode = barcode.replace(/[^0-9]/g, "");
  const script = `
tell application "Simulator" to activate
delay 0.15
tell application "System Events"
  tell process "Simulator"
    keystroke "a" using command down
    delay 0.05
    key code 51
    delay 0.05
    keystroke "${safeBarcode}"
  end tell
end tell`;
  await run("osascript", ["-e", script]);
}

async function axeTree(axePath: string, udid: string): Promise<AxeNode[]> {
  const text = await run(axePath, ["describe-ui", "--udid", udid]);
  return JSON.parse(text) as AxeNode[];
}

function flattenAxeTree(tree: AxeNode[]): AxeNode[] {
  const nodes: AxeNode[] = [];
  const visit = (node: AxeNode): void => {
    nodes.push(node);
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  for (const entry of tree) {
    visit(entry);
  }
  return nodes;
}

async function axeLabels(axePath: string, udid: string): Promise<string[]> {
  const tree = await axeTree(axePath, udid);
  const labels: string[] = [];
  for (const node of flattenAxeTree(tree)) {
    if (node.AXLabel) {
      labels.push(node.AXLabel);
    }
  }
  return labels;
}

function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll("&", " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !["and", "the", "with", "organic", "natural"].includes(word));
}

function labelsMatchProductDetail(labels: string[], productName?: string): boolean {
  const rawScreenText = labels.join(" ").toLowerCase();
  if (!rawScreenText.includes("crunchy") || !rawScreenText.includes("health breakdown")) {
    return false;
  }

  if (!productName) {
    return true;
  }

  const screenText = meaningfulWords(labels.join(" ")).join(" ");
  const words = meaningfulWords(productName);
  const required = words.slice(0, Math.min(words.length, 3));
  if (required.length === 0) {
    return true;
  }

  return required.every((word) => screenText.includes(word));
}

function parseHistoryProduct(label: string): BareHistoryProduct | null {
  const match = label.match(/^(.+),\s*([^,]+),\s*(\d{1,3})$/);
  if (!match) {
    return null;
  }

  return {
    productName: match[1].trim(),
    brand: match[2].trim(),
    score: Number(match[3])
  };
}

function historyRowsFromTree(tree: AxeNode[]): Array<BareHistoryProduct & { frame: NonNullable<AxeNode["frame"]>; label: string }> {
  return flattenAxeTree(tree)
    .map((node) => {
      if (!node.AXLabel || !node.frame || node.type !== "GenericElement") {
        return null;
      }
      if (node.frame.y < 100 || node.frame.y + node.frame.height > 780) {
        return null;
      }
      const product = parseHistoryProduct(node.AXLabel);
      if (!product) {
        return null;
      }
      return { ...product, frame: node.frame, label: node.AXLabel };
    })
    .filter(Boolean) as Array<BareHistoryProduct & { frame: NonNullable<AxeNode["frame"]>; label: string }>;
}

function productMatches(row: BareHistoryProduct, productName?: string): boolean {
  if (!productName) {
    return true;
  }

  const rowWords = meaningfulWords(`${row.brand} ${row.productName}`).join(" ");
  const productWords = meaningfulWords(productName);
  const required = productWords.slice(0, Math.min(productWords.length, 3));
  return required.length === 0 || required.every((word) => rowWords.includes(word));
}

async function navigateToHistory(axePath: string, udid: string, simulatorId: string): Promise<void> {
  await run("xcrun", ["simctl", "openurl", simulatorId, "bare://"]).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 800));

  await closeProductDetailIfOpen(axePath, udid);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await axeTapLabel(axePath, udid, "History, tab, 4 of 5").catch(async () => {
      await axeTap(axePath, udid, 281, 823, 0.8, "simulator");
    });
    const labels = await axeLabels(axePath, udid);
    if (labels.includes("Scan History")) {
      await resetHistoryScrollToTop(axePath, udid);
      return;
    }
  }
  throw new Error("Cannot capture BARE screenshot: History tab did not open.");
}

async function closeProductDetailIfOpen(axePath: string, udid: string): Promise<void> {
  const labels = await axeLabels(axePath, udid).catch((): string[] => []);
  if (labels.includes("Scan History") || labels.includes("Scan Product")) {
    return;
  }

  await axeTap(axePath, udid, 371, 127, 0.35, "simulator").catch(() => undefined);
  await axeTap(axePath, udid, 368, 137, 0.35, "physical").catch(() => undefined);
}

async function navigateToScan(axePath: string, udid: string, simulatorId: string): Promise<void> {
  await run("xcrun", ["simctl", "openurl", simulatorId, "bare://"]).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 800));

  await closeProductDetailIfOpen(axePath, udid);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await axeTapLabel(axePath, udid, "Scan, tab, 2 of 5").catch(async () => {
      await axeTap(axePath, udid, 121, 823, 0.8, "simulator");
    });
    const labels = await axeLabels(axePath, udid);
    if (labels.includes("Scan Product") && labels.includes("Enter barcode manually")) {
      return;
    }
  }
  throw new Error("Cannot capture BARE screenshot: Scan tab did not open.");
}

async function swipeHistoryList(axePath: string, udid: string): Promise<void> {
  await run(axePath, [
    "swipe",
    "--start-x",
    "205",
    "--start-y",
    "735",
    "--end-x",
    "205",
    "--end-y",
    "210",
    "--duration",
    "0.45",
    "--post-delay",
    "0.75",
    "--udid",
    udid
  ]);
}

async function resetHistoryScrollToTop(axePath: string, udid: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await run(axePath, [
      "swipe",
      "--start-x",
      "205",
      "--start-y",
      "210",
      "--end-x",
      "205",
      "--end-y",
      "735",
      "--duration",
      "0.35",
      "--post-delay",
      "0.25",
      "--udid",
      udid
    ]).catch(() => undefined);
  }
}

export async function listBareHistoryProducts({
  simulatorId = process.env.BARE_SIMULATOR_ID ?? DEFAULT_SIMULATOR_ID,
  maxScrolls = 0
}: {
  simulatorId?: string;
  maxScrolls?: number;
} = {}): Promise<BareHistoryProduct[]> {
  const udid = await resolveSimulatorUdid(simulatorId);
  const axePath = await findAxePath();
  const products = new Map<string, BareHistoryProduct>();

  await navigateToHistory(axePath, udid, simulatorId);
  for (let attempt = 0; attempt <= maxScrolls; attempt += 1) {
    const rows = historyRowsFromTree(await axeTree(axePath, udid));
    for (const row of rows) {
      products.set(`${row.brand.toLowerCase()}::${row.productName.toLowerCase()}`, {
        productName: row.productName,
        brand: row.brand,
        score: row.score
      });
    }
    if (attempt < maxScrolls) {
      await swipeHistoryList(axePath, udid);
    }
  }

  return [...products.values()];
}

async function normalizeScreenshot(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .resize({
      width: 1080,
      height: 1920,
      fit: "cover",
      position: "top"
    })
    .png()
    .toFile(outputPath);
}

async function hasProductDetailSheet(inputPath: string): Promise<boolean> {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) {
    return false;
  }

  const stats = await image
    .extract({
      left: 0,
      top: Math.round(height * 0.22),
      width,
      height: Math.round(height * 0.48)
    })
    .stats();
  const luminance =
    (stats.channels[0]?.mean ?? 0) * 0.2126 + (stats.channels[1]?.mean ?? 0) * 0.7152 + (stats.channels[2]?.mean ?? 0) * 0.0722;
  const contrast =
    (stats.channels[0]?.stdev ?? 0) * 0.2126 + (stats.channels[1]?.stdev ?? 0) * 0.7152 + (stats.channels[2]?.stdev ?? 0) * 0.0722;

  const scoreRegion = await sharp(inputPath)
    .extract({
      left: Math.round(width * 0.62),
      top: Math.round(height * 0.12),
      width: Math.round(width * 0.3),
      height: Math.round(height * 0.16)
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let scoreColorPixels = 0;
  const totalPixels = scoreRegion.info.width * scoreRegion.info.height;

  for (let index = 0; index < scoreRegion.data.length; index += scoreRegion.info.channels) {
    const red = scoreRegion.data[index] ?? 0;
    const green = scoreRegion.data[index + 1] ?? 0;
    const blue = scoreRegion.data[index + 2] ?? 0;
    if ((green > 170 && red < 130 && blue < 170) || (red > 220 && green > 120 && green < 190 && blue < 130)) {
      scoreColorPixels += 1;
    }
  }
  const scoreColorRatio = totalPixels ? scoreColorPixels / totalPixels : 0;

  return luminance > 145 && contrast > 24 && scoreColorRatio > 0.012;
}

async function driveHistoryProductOpen(axePath: string, udid: string, simulatorId: string, productName?: string): Promise<void> {
  await navigateToHistory(axePath, udid, simulatorId);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rows = historyRowsFromTree(await axeTree(axePath, udid));
    const row = rows.find((candidate) => productMatches(candidate, productName));
    if (row) {
      await axeTap(
        axePath,
        udid,
        Math.round(row.frame.x + row.frame.width / 2),
        Math.round(row.frame.y + row.frame.height / 2),
        2.2,
        "simulator"
      );
      return;
    }
    await swipeHistoryList(axePath, udid);
  }

  throw new Error(`Cannot capture BARE screenshot: product "${productName ?? "unknown"}" was not visible in History.`);
}

async function driveBarcodeProductOpen(axePath: string, udid: string, simulatorId: string, barcode: string): Promise<void> {
  await navigateToScan(axePath, udid, simulatorId);

  await axeTap(axePath, udid, 170, 724, 0.35, "simulator");
  await typeBarcodeIntoFocusedField(barcode).catch(async () => axeType(axePath, udid, barcode));
  await axeTap(axePath, udid, 363, 724, 3, "simulator");
}

export async function captureBareProductScreenshot({
  jobDir,
  barcode,
  outputName,
  productName,
  simulatorId = process.env.BARE_SIMULATOR_ID ?? DEFAULT_SIMULATOR_ID
}: CaptureBareProductScreenshotOptions): Promise<string> {
  if (!/^\d{6,}$/.test(barcode)) {
    throw new Error(`Cannot capture BARE screenshot: invalid barcode "${barcode}".`);
  }

  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });

  const rawRelativePath = path.join("generated", `${outputName}-raw.png`);
  const relativePath = path.join("generated", `${outputName}.png`);
  const rawPath = path.join(jobDir, rawRelativePath);
  const outputPath = path.join(jobDir, relativePath);
  const udid = await resolveSimulatorUdid(simulatorId);
  const axePath = await findAxePath();

  const captureAndValidate = async (): Promise<boolean> => {
    await screenshot(simulatorId, rawPath);
    const labels = await axeLabels(axePath, udid);
    if ((await hasProductDetailSheet(rawPath)) && labelsMatchProductDetail(labels, productName)) {
      await normalizeScreenshot(rawPath, outputPath);
      return true;
    }
    return false;
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await driveHistoryProductOpen(axePath, udid, simulatorId, productName);
      if (await captureAndValidate()) {
        return relativePath;
      }
    } catch {
      // Fall through to barcode search below.
    }

    try {
      await driveBarcodeProductOpen(axePath, udid, simulatorId, barcode);
      if (await captureAndValidate()) {
        return relativePath;
      }
    } catch {
      // Retry the full history -> barcode sequence.
    }
  }

  throw new Error(`Cannot capture BARE screenshot for ${productName ?? barcode}: matching product detail sheet did not appear.`);
}
