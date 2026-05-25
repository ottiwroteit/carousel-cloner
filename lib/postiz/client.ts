import { readFile } from "node:fs/promises";
import path from "node:path";

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
  date: string;
  caption: string;
  images: PostizUpload[];
  type?: "draft" | "schedule";
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
  const response = await fetch(`${cleanBaseUrl(baseUrl)}/integrations`, {
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
  const file = await readFile(filePath);
  const body = new FormData();
  body.append("file", new Blob([file], { type: mimeForFile(filePath) }), path.basename(filePath));

  const response = await fetch(`${cleanBaseUrl(baseUrl)}/upload`, {
    method: "POST",
    headers: {
      Authorization: apiKey
    },
    body
  });

  return readJsonResponse<PostizUpload>(response);
}

export async function createPostizDraft({
  baseUrl,
  apiKey,
  integrationId,
  date,
  caption,
  images,
  type = "draft"
}: CreatePostizDraftOptions): Promise<unknown> {
  const response = await fetch(`${cleanBaseUrl(baseUrl)}/posts`, {
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
          settings: {
            privacy_level: "PUBLIC_TO_EVERYONE",
            duet: false,
            stitch: false,
            comment: true,
            autoAddMusic: "no",
            brand_content_toggle: false,
            brand_organic_toggle: false,
            content_posting_method: "UPLOAD"
          }
        }
      ]
    })
  });

  return readJsonResponse<unknown>(response);
}
