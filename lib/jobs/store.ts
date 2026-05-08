import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { JobInput, JobStatus } from "@/lib/types";

export type JobSnapshot = {
  dir: string;
  input: JobInput;
  status: JobStatus;
  artifacts: Record<string, unknown>;
};

export const DEFAULT_JOBS_ROOT = path.join(process.cwd(), "outputs", "jobs");

function now(): string {
  return new Date().toISOString();
}

function jobDir(id: string, root = DEFAULT_JOBS_ROOT): string {
  return path.join(root, id);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function createJob(input: JobInput, root = DEFAULT_JOBS_ROOT): Promise<JobSnapshot> {
  const id = crypto.randomUUID();
  const createdAt = now();
  const status: JobStatus = {
    id,
    state: "queued",
    progress: 0,
    message: "Job created",
    createdAt,
    updatedAt: createdAt
  };
  const dir = jobDir(id, root);

  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, "input.json"), input);
  await writeJson(path.join(dir, "status.json"), status);

  return {
    dir,
    input,
    status,
    artifacts: {}
  };
}

export async function updateJobStatus(
  id: string,
  patch: Pick<JobStatus, "state" | "progress" | "message"> & Partial<Pick<JobStatus, "error">>,
  root = DEFAULT_JOBS_ROOT
): Promise<JobStatus> {
  const filePath = path.join(jobDir(id, root), "status.json");
  const status = await readJson<JobStatus>(filePath);
  const updated: JobStatus = {
    ...status,
    ...patch,
    updatedAt: now()
  };

  await writeJson(filePath, updated);
  return updated;
}

export async function writeJobArtifact(id: string, filename: string, value: unknown, root = DEFAULT_JOBS_ROOT): Promise<void> {
  await writeJson(path.join(jobDir(id, root), filename), value);
}

export async function writeJobTextArtifact(id: string, filename: string, value: string, root = DEFAULT_JOBS_ROOT): Promise<void> {
  await writeFile(path.join(jobDir(id, root), filename), value, "utf8");
}

export async function readJobTextArtifact(id: string, filename: string, root = DEFAULT_JOBS_ROOT): Promise<string> {
  return readFile(path.join(jobDir(id, root), filename), "utf8");
}

export async function readJob(id: string, root = DEFAULT_JOBS_ROOT): Promise<JobSnapshot> {
  const dir = jobDir(id, root);
  const input = await readJson<JobInput>(path.join(dir, "input.json"));
  const status = await readJson<JobStatus>(path.join(dir, "status.json"));
  const files = await readdir(dir);
  const artifacts: Record<string, unknown> = {};

  for (const file of files) {
    if (!file.endsWith(".json") || file === "input.json" || file === "status.json") {
      continue;
    }
    artifacts[file] = await readJson(path.join(dir, file));
  }

  return {
    dir,
    input,
    status,
    artifacts
  };
}
