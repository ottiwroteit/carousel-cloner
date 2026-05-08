import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getPhoneBaseUrl } from "@/lib/network";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const requestUrl = new URL(request.url);
  const origin = requestUrl.searchParams.get("origin") ?? requestUrl.origin;
  const phoneUrl = `${getPhoneBaseUrl(origin)}/jobs/${id}/phone`;
  const svg = await QRCode.toString(phoneUrl, {
    type: "svg",
    margin: 1,
    width: 320,
    color: {
      dark: "#080a0f",
      light: "#ffffff"
    }
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
