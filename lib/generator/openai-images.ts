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
      model: "gpt-image-1";
      prompt: string;
      size: "1024x1536";
      quality: "low" | "medium" | "high" | "auto";
      output_format: "png";
      n: 1;
    }) => Promise<ImageGenerateResponse>;
  };
};

type GenerateOpenAIImagesOptions = {
  jobDir: string;
  prompts: string[];
  apiKey?: string;
  client?: ImageClient;
};

function createClient(apiKey?: string): ImageClient {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for ChatGPT image generation.");
  }

  return new OpenAI({ apiKey }) as ImageClient;
}

export async function generateOpenAIImages({
  jobDir,
  prompts,
  apiKey = process.env.OPENAI_API_KEY,
  client
}: GenerateOpenAIImagesOptions): Promise<string[]> {
  const generatedDir = path.join(jobDir, "generated");
  await mkdir(generatedDir, { recursive: true });

  const imageClient = client ?? createClient(apiKey);
  const paths: string[] = [];

  for (const [index, prompt] of prompts.entries()) {
    const response = await imageClient.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1536",
      quality: "medium",
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
