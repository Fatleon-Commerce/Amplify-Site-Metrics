import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { ADMIN_COOKIE, jsonError } from "@/server/http";
import { isSiteKey } from "@/server/metrics/ids";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { siteKey: string } }) {
  const token = cookies().get(ADMIN_COOKIE)?.value ?? "";
  if (!token) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!isSiteKey(params.siteKey)) {
    return NextResponse.json({ error: "Unknown site" }, { status: 404 });
  }

  try {
    const backend = await getBackend();
    const result = await backend.deleteSite(token, params.siteKey);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
