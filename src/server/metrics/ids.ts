import { randomBytes } from "node:crypto";
import { BOARD_MESSAGE_ID_LENGTH, SITE_KEY_LENGTH } from "../../lib/constants";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function createId(length: number): string {
  const bytes = randomBytes(length);
  let key = "";
  for (let index = 0; index < length; index += 1) {
    key += ALPHABET[bytes[index]! % ALPHABET.length];
  }
  return key;
}

export function createSiteKey(): string {
  return createId(SITE_KEY_LENGTH);
}

export function createMessageId(): string {
  return createId(BOARD_MESSAGE_ID_LENGTH);
}

export function isSiteKey(value: string): boolean {
  return new RegExp(`^[a-z0-9]{${SITE_KEY_LENGTH}}$`).test(value);
}

export function isMessageId(value: string): boolean {
  return new RegExp(`^[a-z0-9]{${BOARD_MESSAGE_ID_LENGTH}}$`).test(value);
}

export function isClientId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(value);
}

export function isDayKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function nextDayKey(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  return next.toISOString().slice(0, 10);
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
