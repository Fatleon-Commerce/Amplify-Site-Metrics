import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { TOKEN_TTL_MS } from "../../lib/constants";

const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function resetLoginAttempts(): void {
  attempts.clear();
}

export function tooManyLogins(ip: string, now = Date.now()): boolean {
  const recent = (attempts.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  attempts.set(ip, recent);
  return recent.length >= MAX_ATTEMPTS;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  const recent = attempts.get(ip) ?? [];
  recent.push(now);
  attempts.set(ip, recent);
}

export function clearLoginAttempts(ip: string): void {
  attempts.delete(ip);
}

export function passwordsMatch(attempt: string, expected: string): boolean {
  const left = createHash("sha256").update(attempt).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function signToken(password: string, exp = Date.now() + TOKEN_TTL_MS): string {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const signature = createHmac("sha256", password).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyToken(password: string, token: string, now = Date.now()): boolean {
  if (!password || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", password).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof body.exp === "number" && body.exp > now;
  } catch {
    return false;
  }
}

export function signBoardStamp(password: string, siteKey: string, iat = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ kind: "board", siteKey, iat })).toString("base64url");
  const signature = createHmac("sha256", password).update(`board.${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function boardStampAge(password: string, token: string, siteKey: string, now = Date.now()): number | null {
  if (!password || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", password).update(`board.${payload}`).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      kind?: unknown;
      siteKey?: unknown;
      iat?: unknown;
    };
    if (body.kind !== "board" || body.siteKey !== siteKey || typeof body.iat !== "number" || !Number.isFinite(body.iat)) {
      return null;
    }
    const age = now - body.iat;
    if (age < 0) return null;
    return age;
  } catch {
    return null;
  }
}
