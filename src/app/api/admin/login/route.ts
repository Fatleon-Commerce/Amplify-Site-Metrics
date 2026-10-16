import { NextRequest, NextResponse } from "next/server";
import { getBackend } from "@/server/backend";
import { ADMIN_COOKIE, clientIp, cookieOptions } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Enter a password" }, { status: 400 });
  }

  const backend = await getBackend();
  const result = await backend.login(password, clientIp(request));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, result.token, cookieOptions());
  return response;
}
