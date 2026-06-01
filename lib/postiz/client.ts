import path from "node:path";
import { fetchWithCurlFallback, uploadFileWithCurl } from "@/lib/http";

export type PostizIntegration = {
  id: string;
  name?: string;
  profile?: string;
  identifier?: string;
  picture?: string;
};

export type PostizUpload = {
  id: string;
  name: string;
  path: string;
};

export type CreatePostizDraftOptions = {
  baseUrl: string;
  apiKey: string;
  integrationId: string;
  integrationIdentifier?: string;
  date: string;
  caption: string;
  images: PostizUpload[];
  type?: "draft" | "schedule";
};

export type PostizPostSummary = {
  id: string;
  date?: string;
  integrationIds: string[];
};

function cleanBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Postiz API ${response.status}: ${text || response.statusText}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function listPostizIntegrations(baseUrl: string, apiKey: string): Promise<PostizIntegration[]> {
  const response = await fetchWithCurlFallback(`${cleanBaseUrl(baseUrl)}/integrations`, {
    headers: {
      Authorization: apiKey
    }
  });
  return readJsonResponse<PostizIntegration[]>(response);
}

function mimeForFile(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  return "image/png";
}

export async function uploadPostizImage(baseUrl: string, apiKey: string, filePath: string): Promise<PostizUpload> {
  const response = await uploadFileWithCurl({
    url: `${cleanBaseUrl(baseUrl)}/upload`,
    headers: {
      Authorization: apiKey
    },
    filePath,
    mimeType: mimeForFile(filePath),
    filename: path.basename(filePath)
  });

  return readJsonResponse<PostizUpload>(response);
}

function flattenPostizNodes(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenPostizNodes(entry));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const nestedKeys = ["data", "items", "posts", "result", "results", "entries"];
  for (const key of nestedKeys) {
    if (key in record) {
      if (Array.isArray(record[key])) {
        return flattenPostizNodes(record[key]);
      }
      const nested = flattenPostizNodes(record[key]);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  return [record];
}

function parsePostSummary(node: unknown): PostizPostSummary | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const record = node as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : typeof record._id === "string" ? record._id : undefined;
  if (!id) {
    return null;
  }

  const integrationIds = new Set<string>();
  const addIntegrationId = (value: unknown): void => {
    if (typeof value === "string" && value) {
      integrationIds.add(value);
    }
  };

  const directPosts = Array.isArray(record.posts) ? record.posts : [];
  const directIntegration = record.integration;
  if (directIntegration && typeof directIntegration === "object") {
    addIntegrationId((directIntegration as Record<string, unknown>).id);
    addIntegrationId((directIntegration as Record<string, unknown>)._id);
  }
  addIntegrationId(record.integrationId);

  for (const post of directPosts) {
    if (!post || typeof post !== "object") {
      continue;
    }
    const integration = (post as Record<string, unknown>).integration;
    if (integration && typeof integration === "object") {
      addIntegrationId((integration as Record<string, unknown>).id);
      addIntegrationId((integration as Record<string, unknown>)._id);
    }
    addIntegrationId((post as Record<string, unknown>).integrationId);
  }

  const dateCandidates = [record.date, record.publishDate, record.scheduledDate, record.createdAt];
  const date = dateCandidates.find((value) => typeof value === "string") as string | undefined;

  return {
    id,
    date,
    integrationIds: [...integrationIds]
  };
}

export async function listPostizPosts(baseUrl: string, apiKey: string): Promise<PostizPostSummary[]> {
  const url = cleanBaseUrl(baseUrl);
  const now = new Date();
  const startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
  const dateQuery = `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
  const candidates = [
    `${url}/posts?${dateQuery}`,
    `${url}/posts?${dateQuery}&limit=100`,
    `${url}/posts?${dateQuery}&page=1&limit=100`,
    `${url}/posts?${dateQuery}&perPage=100&page=1`
  ];
  let lastError: string | undefined;

  for (const candidate of candidates) {
    const response = await fetchWithCurlFallback(candidate, {
      headers: {
        Authorization: apiKey
      }
    });
    if (!response.ok) {
      lastError = `Postiz API ${response.status} at ${candidate}`;
      continue;
    }

    const payload = (await readJsonResponse<unknown>(response)) as unknown;
    const posts = flattenPostizNodes(payload)
      .map((node) => parsePostSummary(node))
      .filter((entry): entry is PostizPostSummary => Boolean(entry));
    if (posts.length > 0 || Array.isArray(payload) || (payload && typeof payload === "object" && "posts" in payload)) {
      return posts;
    }
  }

  throw new Error(lastError ?? "Unable to read existing Postiz posts for spacing validation.");
}

function settingsForIntegration(identifier?: string): Record<string, unknown> {
  const normalized = (identifier ?? "").toLowerCase();
  if (normalized.includes("instagram")) {
    return {
      post_type: "post"
    };
  }

  if (normalized !== "tiktok") {
    return {};
  }

  return {
    privacy_level: "PUBLIC_TO_EVERYONE",
    duet: false,
    stitch: false,
    comment: true,
    autoAddMusic: "yes",
    brand_content_toggle: false,
    brand_organic_toggle: false,
    content_posting_method: "UPLOAD"
  };
}

export async function createPostizDraft({
  baseUrl,
  apiKey,
  integrationId,
  integrationIdentifier,
  date,
  caption,
  images,
  type = "draft"
}: CreatePostizDraftOptions): Promise<unknown> {
  const response = await fetchWithCurlFallback(`${cleanBaseUrl(baseUrl)}/posts`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type,
      creationMethod: "carousel-cloner",
      date,
      shortLink: true,
      tags: [],
      posts: [
        {
          integration: {
            id: integrationId
          },
          value: [
            {
              content: caption,
              image: images.map((image) => ({
                id: image.id,
                path: image.path
              })),
              delay: 0
            }
          ],
          settings: settingsForIntegration(integrationIdentifier)
        }
      ]
    })
  });

  return readJsonResponse<unknown>(response);
}
