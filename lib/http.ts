import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type CurlFetchInit = RequestInit & {
  url: string;
};

type CurlUploadInit = {
  url: string;
  headers?: Record<string, string>;
  filePath: string;
  fieldName?: string;
  mimeType?: string;
  filename?: string;
};

function normalizeUrl(input: string | URL): string {
  return input instanceof URL ? input.toString() : input;
}

function shouldUseCurlFallback(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (!error.message.toLowerCase().includes("fetch failed")) {
    return false;
  }

  const cause = error.cause;
  if (!(cause instanceof AggregateError)) {
    return false;
  }

  return cause.errors.some(
    (entry) => entry instanceof Error && "code" in entry && (entry as NodeJS.ErrnoException).code === "EPERM"
  );
}

function responseFromCurl(status: number, headersText: string, body: Buffer): Response {
  const sections = headersText
    .split(/\r?\n\r?\n/)
    .map((section) => section.trim())
    .filter((section) => section.startsWith("HTTP/"));
  const finalSection = sections.at(-1) ?? "";
  const headerLines = finalSection.split(/\r?\n/).slice(1);
  const headers = new Headers();

  for (const line of headerLines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) {
      continue;
    }
    headers.append(line.slice(0, colonIndex).trim(), line.slice(colonIndex + 1).trim());
  }

  return new Response(new Uint8Array(body), {
    status,
    headers
  });
}

async function runCurl(args: string[]): Promise<Response> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "carousel-cloner-curl-"));
  const headersPath = path.join(tempRoot, "headers.txt");
  const bodyPath = path.join(tempRoot, "body.bin");

  try {
    await execFileAsync("curl", ["-sS", "-L", "-D", headersPath, "-o", bodyPath, ...args], {
      maxBuffer: 1024 * 1024 * 20
    });
    const [headersText, body] = await Promise.all([readFile(headersPath, "utf8"), readFile(bodyPath)]);
    const sections = headersText
      .split(/\r?\n\r?\n/)
      .map((section) => section.trim())
      .filter((section) => section.startsWith("HTTP/"));
    const statusLine = sections.at(-1)?.split(/\r?\n/, 1)[0] ?? "";
    const statusMatch = statusLine.match(/^HTTP\/\S+\s+(\d{3})\b/);
    const status = statusMatch ? Number(statusMatch[1]) : 200;
    return responseFromCurl(status, headersText, body);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function curlFetch({ url, method, headers, body }: CurlFetchInit): Promise<Response> {
  const args = ["-X", method ?? "GET"];

  if (headers) {
    const entries = headers instanceof Headers ? Array.from(headers.entries()) : Object.entries(headers as Record<string, string>);
    for (const [key, value] of entries) {
      args.push("-H", `${key}: ${value}`);
    }
  }

  if (typeof body === "string") {
    args.push("--data-binary", body);
  } else if (body instanceof URLSearchParams) {
    args.push("--data-binary", body.toString());
  } else if (body != null) {
    throw new Error("curl fetch fallback only supports string and URLSearchParams bodies.");
  }

  args.push(url);
  return runCurl(args);
}

export async function fetchWithCurlFallback(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = normalizeUrl(input);

  try {
    return await fetch(url, init);
  } catch (error) {
    if (!shouldUseCurlFallback(error)) {
      throw error;
    }

    return curlFetch({
      url,
      ...init
    });
  }
}

export async function uploadFileWithCurl({ url, headers, filePath, fieldName = "file", mimeType, filename }: CurlUploadInit): Promise<Response> {
  const args: string[] = [];

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      args.push("-H", `${key}: ${value}`);
    }
  }

  const safeFilename = filename ?? path.basename(filePath);
  const formValue = `${fieldName}=@${filePath};filename=${safeFilename}${mimeType ? `;type=${mimeType}` : ""}`;
  args.push("-F", formValue, url);
  return runCurl(args);
}
