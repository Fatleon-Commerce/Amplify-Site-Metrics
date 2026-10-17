import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { ADMIN_COOKIE, jsonError } from "@/server/http";
import { isMessageId, isSiteKey } from "@/server/metrics/ids";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { siteKey: string; messageId: string } }) {
  const token = cookies().get(ADMIN_COOKIE)?.value ?? "";
  if (!token) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  if (!isSiteKey(params.siteKey) || !isMessageId(params.messageId)) {
    return NextResponse.json({ error: "Unknown message" }, { status: 404 });
  }

  try {
    const backend = await getBackend();
    const result = await backend.deleteBoardMessage(token, params.siteKey, params.messageId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
