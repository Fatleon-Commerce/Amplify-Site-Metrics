import { NextRequest, NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { clientIp } from "@/server/http";
import { isSiteKey } from "@/server/metrics/ids";

export const dynamic = "force-dynamic";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: cors });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

export async function GET(_request: NextRequest, { params }: { params: { siteKey: string } }) {
  if (!isSiteKey(params.siteKey)) return json({ ok: false, error: "closed" }, 404);
  const backend = await getBackend();
  const result = await backend.openBoard(params.siteKey);
  if (!result.ok) return json({ ok: false, error: result.error }, result.status);
  return json(result);
}

export async function POST(request: NextRequest, { params }: { params: { siteKey: string } }) {
  if (!isSiteKey(params.siteKey)) return json({ ok: false, error: "closed" }, 404);
  const raw = await request.text();
  if (raw.length > 8000) return json({ ok: false, error: "large" }, 413);

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }

  const backend = await getBackend();
  const result = await backend.postBoard(params.siteKey, input, {
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent") ?? "",
  });
  if (!result.ok) return json({ ok: false, error: result.error }, result.status);
  return json(result);
}
