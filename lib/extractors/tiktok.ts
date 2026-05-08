import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SourceArtifact } from "@/lib/types";

const execFileAsync = promisify(execFile);

export type ExtractorError = {
  code: "missing_yt_dlp" | "blocked" | "invalid_metadata" | "unknown";
  message: string;
};

export type RunnerResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
};

export type ExtractTikTokSourceOptions = {
  url: string;
  jobDir: string;
  cookiesFile?: string;
  run?: (args: string[]) => Promise<RunnerResult>;
};

export type ExtractTikTokSourceResult =
  | {
      ok: true;
      source: SourceArtifact;
    }
  | {
      ok: false;
      error: ExtractorError;
    };

export function normalizeExtractorError(error: unknown): ExtractorError {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ENOENT") || message.includes("not found")) {
    return {
      code: "missing_yt_dlp",
      message: "yt-dlp is not installed or is not available on PATH."
    };
  }

  if (message.includes("403") || message.toLowerCase().includes("forbidden") || message.toLowerCase().includes("blocked")) {
    return {
      code: "blocked",
      message: "TikTok blocked direct extraction for this URL."
    };
  }

  return {
    code: "unknown",
    message: "TikTok extraction failed before source slides could be read."
  };
}

async function defaultRunner(args: string[]): Promise<RunnerResult> {
  try {
    const { stdout, stderr } = await execFileAsync("yt-dlp", args, {
      maxBuffer: 1024 * 1024 * 20
    });
    return {
      ok: true,
      stdout,
      stderr
    };
  } catch (error) {
    const maybe = error as { stdout?: string; stderr?: string };
    return {
      ok: false,
      stdout: maybe.stdout ?? "",
      stderr: maybe.stderr ?? (error instanceof Error ? error.message : String(error))
    };
  }
}

export async function extractTikTokSource(options: ExtractTikTokSourceOptions): Promise<ExtractTikTokSourceResult> {
  const args = ["--dump-single-json", "--no-playlist", options.url];
  if (options.cookiesFile) {
    args.unshift("--cookies", options.cookiesFile);
  }

  const run = options.run ?? defaultRunner;

  try {
    const result = await run(args);
    if (!result.ok) {
      return {
        ok: false,
        error: normalizeExtractorError(`${result.stderr}\n${result.stdout}`)
      };
    }

    const metadata = JSON.parse(result.stdout) as Record<string, unknown>;
    const thumbnails = Array.isArray(metadata.thumbnails) ? metadata.thumbnails : [];
    const images = thumbnails
      .map((thumbnail) => (typeof thumbnail === "object" && thumbnail !== null ? (thumbnail as { url?: unknown }).url : undefined))
      .filter((url): url is string => typeof url === "string");

    return {
      ok: true,
      source: {
        images,
        metadata,
        warning: images.length === 0 ? "No slide image URLs were exposed by yt-dlp metadata." : undefined
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeExtractorError(error)
    };
  }
}
