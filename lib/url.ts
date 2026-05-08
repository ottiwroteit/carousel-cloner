export type TikTokUrlResult =
  | {
      ok: true;
      url: string;
      hostname: string;
    }
  | {
      ok: false;
      message: string;
    };

const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);

export function validateTikTokUrl(input: string): TikTokUrlResult {
  let parsed: URL;

  try {
    parsed = new URL(input.trim());
  } catch {
    return {
      ok: false,
      message: "Enter a valid URL."
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!TIKTOK_HOSTS.has(hostname)) {
    return {
      ok: false,
      message: "Enter a TikTok slideshow or video URL."
    };
  }

  return {
    ok: true,
    url: parsed.toString(),
    hostname
  };
}
