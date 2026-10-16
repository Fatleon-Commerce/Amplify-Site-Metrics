import { NextRequest, NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { clientIp } from "@/server/http";

export const dynamic = "force-dynamic";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 8000) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413, headers: cors });
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const cityHeader = request.headers.get("cloudfront-viewer-city") ?? "";
  let city = cityHeader;
  try {
    city = decodeURIComponent(cityHeader);
  } catch {
    city = cityHeader;
  }

  const backend = await getBackend();
  const result = await backend.collect(input, {
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent") ?? "",
    country: request.headers.get("cloudfront-viewer-country") ?? "",
    city,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status, headers: cors });
  }
  return new NextResponse(null, { status: 204, headers: cors });
}
