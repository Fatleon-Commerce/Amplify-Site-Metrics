import { NextRequest, NextResponse } from "next/server";
import { isSiteKey } from "@/server/metrics/ids";
import { trackerScript } from "@/server/metrics/script";
import { getBackend } from "@/server/backend";
import { publicOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { siteKey: string } }) {
  if (!isSiteKey(params.siteKey)) {
    return new NextResponse("unknown site", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const backend = await getBackend();
  const exists = await backend.siteExists(params.siteKey);
  if (!exists) {
    return new NextResponse("unknown site", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const script = trackerScript(params.siteKey, `${publicOrigin()}/api/collect`);
  return new NextResponse(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
