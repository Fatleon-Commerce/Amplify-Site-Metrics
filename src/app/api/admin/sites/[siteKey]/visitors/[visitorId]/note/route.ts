import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { ADMIN_COOKIE, jsonError } from "@/server/http";
import { isClientId, isSiteKey } from "@/server/metrics/ids";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { siteKey: string; visitorId: string } }) {
  const token = cookies().get(ADMIN_COOKIE)?.value ?? "";
  if (!token) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!isSiteKey(params.siteKey) || !isClientId(params.visitorId)) {
    return NextResponse.json({ error: "Unknown visitor" }, { status: 404 });
  }

  let note = "";
  let mark = "";
  try {
    const body = (await request.json()) as { note?: unknown; mark?: unknown };
    note = typeof body.note === "string" ? body.note : "";
    mark = typeof body.mark === "string" ? body.mark : "";
  } catch {
    return NextResponse.json({ error: "Enter a note" }, { status: 400 });
  }

  try {
    const backend = await getBackend();
    const result = await backend.saveNote(token, params.siteKey, params.visitorId, note, mark);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
