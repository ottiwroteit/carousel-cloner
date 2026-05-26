import { execFile } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

type CaptureBareProductScreenshotOptions = {
  jobDir: string;
  barcode: string;
  outputName: string;
  simulatorId?: string;
  bundleId?: string;
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

async function axeTap(axePath: string, udid: string, x: number, y: number, postDelay = 0.35): Promise<void> {
  await run(axePath, ["tap", "-x", String(x), "-y", String(y), "--udid", udid, "--post-delay", String(postDelay)]);
}

async function axeType(axePath: string, udid: string, text: string): Promise<void> {
  await run(axePath, ["type", text, "--udid", udid]);
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

async function driveBarcodeSearch(axePath: string, udid: string, simulatorId: string, barcode: string): Promise<void> {
  await run("xcrun", ["simctl", "openurl", simulatorId, "bare://"]).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 800));

  // The six-step proof workflow: Scan tab -> manual barcode field -> type barcode -> submit -> product detail sheet.
  await axeTap(axePath, udid, 368, 137, 0.45).catch(() => undefined);
  await axeTap(axePath, udid, 121, 825, 0.55);
  await axeTap(axePath, udid, 150, 724, 0.35);
  await axeType(axePath, udid, barcode);
  await axeTap(axePath, udid, 363, 724, 3.8);
}

export async function captureBareProductScreenshot({
  jobDir,
  barcode,
  outputName,
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

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await driveBarcodeSearch(axePath, udid, simulatorId, barcode);
    await screenshot(simulatorId, rawPath);
    if (await hasProductDetailSheet(rawPath)) {
      await normalizeScreenshot(rawPath, outputPath);
      return relativePath;
    }
  }

  throw new Error(`Cannot capture BARE screenshot for barcode ${barcode}: product detail sheet did not appear.`);
}
