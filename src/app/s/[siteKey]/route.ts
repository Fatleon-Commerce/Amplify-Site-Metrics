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
  const config = await backend.siteConfig(params.siteKey);
  if (!config) {
    return new NextResponse("unknown site", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const origin = publicOrigin();
  const boardEndpoint = config.guestbookEnabled ? `${origin}/api/board/${params.siteKey}` : "";
  const script = trackerScript(params.siteKey, `${origin}/api/collect`, boardEndpoint);
  return new NextResponse(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}
