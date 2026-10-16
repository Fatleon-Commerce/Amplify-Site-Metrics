import { randomBytes } from "node:crypto";
import { SITE_KEY_LENGTH } from "../../lib/constants";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function createSiteKey(): string {
  const bytes = randomBytes(SITE_KEY_LENGTH);
  let key = "";
  for (let index = 0; index < SITE_KEY_LENGTH; index += 1) {
    key += ALPHABET[bytes[index]! % ALPHABET.length];
  }
  return key;
}

export function isSiteKey(value: string): boolean {
  return new RegExp(`^[a-z0-9]{${SITE_KEY_LENGTH}}$`).test(value);
}

export function isClientId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}

export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function recentDayKeys(count: number, now: Date): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    keys.push(dayKey(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000)));
  }
  return keys;
}

export function ttlAfter(days: number, now: Date): number {
  return Math.floor(now.getTime() / 1000) + days * 24 * 60 * 60;
}

export function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}
