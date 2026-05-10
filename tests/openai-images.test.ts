import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { generateOpenAIImages } from "@/lib/generator/openai-images";

let root: string | undefined;

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe("generateOpenAIImages", () => {
  test("writes base64 OpenAI image responses as png files", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-openai-images-"));
    const pngBytes = Buffer.from("fake png bytes");
    const calls: unknown[] = [];

    const result = await generateOpenAIImages({
      jobDir: root,
      prompts: ["Create slide one", "Create slide two"],
      config: {
        model: "gpt-image-1-mini",
        quality: "low",
        enabled: true
      },
      client: {
        images: {
          generate: async (params) => {
            calls.push(params);
            return {
              data: [{ b64_json: pngBytes.toString("base64") }]
            };
          }
        }
      }
    });

    expect(result).toEqual(["generated/slide-01.png", "generated/slide-02.png"]);
    expect(calls[0]).toMatchObject({
      model: "gpt-image-1-mini",
      quality: "low",
      size: "1024x1536"
    });
    await expect(readFile(path.join(root, result[0]))).resolves.toEqual(pngBytes);
  });

  test("can write review candidates without overwriting normal slide files", async () => {
    root = await mkdtemp(path.join(tmpdir(), "carousel-openai-images-"));
    const pngBytes = Buffer.from("review png bytes");

    const result = await generateOpenAIImages({
      jobDir: root,
      prompts: ["Create a replacement product image"],
      outputNames: ["review-02-siete-chips-3-gpt"],
      config: {
        model: "gpt-image-1",
        quality: "high",
        enabled: true
      },
      client: {
        images: {
          generate: async () => ({
            data: [{ b64_json: pngBytes.toString("base64") }]
          })
        }
      }
    });

    expect(result).toEqual(["generated/review-02-siete-chips-3-gpt.png"]);
    await expect(readFile(path.join(root, result[0]))).resolves.toEqual(pngBytes);
  });
});
