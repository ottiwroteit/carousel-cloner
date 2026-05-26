import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("BARE proof image renderer", () => {
  test("does not include competitor-branded Olive analysis copy", async () => {
    const source = await readFile(path.join(process.cwd(), "lib/generator/compose-bare-proof-image.ts"), "utf8");

    expect(source).toContain("BARE Analysis");
    expect(source).not.toMatch(/Olive['’]s Analysis/i);
  });
});
