import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { ADMIN_COOKIE, jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = cookies().get(ADMIN_COOKIE)?.value ?? "";
  if (!token) return NextResponse.json({ error: "Sign in again" }, { status: 401 });

  let name = "";
  try {
    const body = (await request.json()) as { name?: unknown };
    name = typeof body.name === "string" ? body.name : "";
  } catch {
    return NextResponse.json({ error: "Enter a site name" }, { status: 400 });
  }

  try {
    const backend = await getBackend();
    const result = await backend.createSite(token, name);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ siteKey: result.siteKey });
  } catch (error) {
    return jsonError(error);
  }
}
