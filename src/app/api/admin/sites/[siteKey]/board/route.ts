import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { ADMIN_COOKIE, jsonError } from "@/server/http";
import { isSiteKey } from "@/server/metrics/ids";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { siteKey: string } }) {
  const token = cookies().get(ADMIN_COOKIE)?.value ?? "";
  if (!token) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!isSiteKey(params.siteKey)) return NextResponse.json({ error: "Unknown site" }, { status: 404 });

  let enabled = false;
  try {
    const body = (await request.json()) as { enabled?: unknown };
    enabled = body.enabled === true;
  } catch {
    return NextResponse.json({ error: "Could not update the guestbook" }, { status: 400 });
  }

  try {
    const backend = await getBackend();
    const result = await backend.setGuestbook(token, params.siteKey, enabled);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
