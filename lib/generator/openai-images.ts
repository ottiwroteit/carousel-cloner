import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

type ImageGenerateResponse = {
  data?: Array<{
    b64_json?: string | null;
  }>;
};

type ImageClient = {
  images: {
    generate: (params: {
      model: OpenAIImageModel;
      prompt: string;
      size: "1024x1536";
      quality: OpenAIImageQuality;
      output_format: "png";
      n: 1;
    }) => Promise<ImageGenerateResponse>;
  };
};

export type OpenAIImageModel = "gpt-image-1-mini" | "gpt-image-1";
export type OpenAIImageQuality = "low" | "medium" | "high" | "auto";

export type OpenAIImageConfig = {
  model: OpenAIImageModel;
  quality: OpenAIImageQuality;
  enabled: boolean;
};

type GenerateOpenAIImagesOptions = {
  jobDir: string;
  prompts: string[];
  apiKey?: string;
  config?: OpenAIImageConfig;
  client?: ImageClient;
};

function createClient(apiKey?: string): ImageClient {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for ChatGPT image generation.");
  }

  return new OpenAI({ apiKey }) as ImageClient;
}

function parseImageModel(value: string | undefined): OpenAIImageModel {
  if (value === "gpt-image-1") {
    return value;
  }

  return "gpt-image-1-mini";
}

function parseImageQuality(value: string | undefined): OpenAIImageQuality {
  if (value === "low" || value === "high" || value === "auto") {
    return value;
  }

  return "medium";
}

export function getOpenAIImageConfig(env = process.env): OpenAIImageConfig {
  return {
    model: parseImageModel(env.OPENAI_IMAGE_MODEL),
    quality: parseImageQuality(env.OPENAI_IMAGE_QUALITY),
    enabled: env.CAROUSEL_IMAGE_PROVIDER === "openai" || env.OPENAI_IMAGE_PROVIDER === "openai"
  };
}

export async function generateOpenAIImages({
  jobDir,
  prompts,
  apiKey = process.env.OPENAI_API_KEY,
  config = getOpenAIImageConfig(),
  client
}: GenerateOpenAIImagesOptions): Promise<string[]> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });

  const imageClient = client ?? createClient(apiKey);
  const paths: string[] = [];

  for (const [index, prompt] of prompts.entries()) {
    const response = await imageClient.images.generate({
      model: config.model,
      prompt,
      size: "1024x1536",
      quality: config.quality,
      output_format: "png",
      n: 1
    });
    const b64 = response.data?.[0]?.b64_json;

    if (!b64) {
      throw new Error(`OpenAI image generation returned no image data for slide ${index + 1}.`);
    }

    const filename = `slide-${String(index + 1).padStart(2, "0")}.png`;
    const relativePath = path.join("generated", filename);
    await writeFile(path.join(jobDir, relativePath), Buffer.from(b64, "base64"));
    paths.push(relativePath);
  }

  return paths;
}
