import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { ADMIN_COOKIE, jsonError } from "@/server/http";
import { isSiteKey } from "@/server/metrics/ids";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE)?.value ?? "";
  if (!token) return NextResponse.json({ error: "Sign in again" }, { status: 401 });

  let siteKey = "";
  let direction: "up" | "down" | "" = "";
  try {
    const body = (await request.json()) as { siteKey?: unknown; direction?: unknown };
    siteKey = typeof body.siteKey === "string" ? body.siteKey : "";
    direction = body.direction === "up" || body.direction === "down" ? body.direction : "";
  } catch {
    return NextResponse.json({ error: "Could not move the site" }, { status: 400 });
  }
  if (!isSiteKey(siteKey)) return NextResponse.json({ error: "Unknown site" }, { status: 404 });
  if (!direction) return NextResponse.json({ error: "Unknown direction" }, { status: 400 });

  try {
    const backend = await getBackend();
    const result = await backend.moveSite(token, siteKey, direction);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
