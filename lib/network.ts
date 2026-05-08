import { networkInterfaces } from "node:os";

export function firstLanAddress(): string {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return "localhost";
}

export function getPhoneBaseUrl(baseUrl: string, resolveLanAddress = firstLanAddress): string {
  const url = new URL(baseUrl);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") {
    url.hostname = resolveLanAddress();
  }

  return url.origin;
}
