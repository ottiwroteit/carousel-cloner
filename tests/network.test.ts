import { describe, expect, test } from "vitest";
import { getPhoneBaseUrl } from "@/lib/network";

describe("getPhoneBaseUrl", () => {
  test("keeps non-localhost hosts", () => {
    expect(getPhoneBaseUrl("http://192.168.1.10:3000", () => "10.0.0.2")).toBe("http://192.168.1.10:3000");
  });

  test("replaces localhost with the LAN address", () => {
    expect(getPhoneBaseUrl("http://localhost:3000", () => "192.168.1.78")).toBe("http://192.168.1.78:3000");
  });
});
