import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { getBackend, type MetricsBackend } from "./backend";

export const ADMIN_COOKIE = "sm_admin";
const TOKEN_MAX_AGE = 14 * 24 * 60 * 60;

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "";
  return request.headers.get("x-real-ip") ?? "";
}

export function publicOrigin(): string {
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  };
}

export async function requireAdmin(): Promise<{ token: string; backend: MetricsBackend }> {
  const token = cookies().get(ADMIN_COOKIE)?.value ?? "";
  const backend = await getBackend();
  if (!token || !(await backend.verify(token))) redirect("/admin/login");
  return { token, backend };
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof Error && error.name === "AuthError") {
    return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "Request failed";
  return NextResponse.json({ error: message }, { status: 500 });
}
