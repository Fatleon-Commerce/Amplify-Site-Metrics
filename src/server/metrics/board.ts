import {
  BOARD_LIST_LIMIT,
  BOARD_MAX_BODY,
  BOARD_MAX_NAME,
  BOARD_MIN_DELAY_MS,
  BOARD_MIN_GAP_MS,
  BOARD_RATE_LIMIT,
  BOARD_RATE_WINDOW_MS,
  BOARD_STAMP_TTL_MS,
} from "../../lib/constants";
import { clip, createMessageId, isMessageId, isSiteKey, ttlAfter } from "./ids";
import { isBot } from "./parse";
import { boardStampAge, signBoardStamp } from "./token";
import type { CollectMeta, MessageRecord, PublicBoardMessage, Repo } from "./types";

export type BoardOpenResult =
  | { ok: true; enabled: false }
  | { ok: true; enabled: true; messages: PublicBoardMessage[]; stamp: string }
  | { ok: false; status: number; error: string };

export type BoardPostResult =
  | { ok: true; message?: PublicBoardMessage; stamp?: string }
  | { ok: false; status: number; error: string };

function readObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function cleanBody(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001F]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, BOARD_MAX_NAME);
}

export function publishMessage(message: MessageRecord): PublicBoardMessage {
  return {
    messageId: message.messageId,
    name: message.name,
    body: message.body,
    createdAt: message.createdAt,
  };
}

export async function setGuestbookEnabled(
  repo: Repo,
  siteKey: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSiteKey(siteKey)) return { ok: false, error: "Unknown site" };
  const site = await repo.getSite(siteKey);
  if (!site) return { ok: false, error: "Unknown site" };
  site.guestbookEnabled = enabled;
  await repo.putSite(site);
  return { ok: true };
}

export async function loadBoardMessages(repo: Repo, siteKey: string): Promise<MessageRecord[] | null> {
  if (!isSiteKey(siteKey)) return null;
  const site = await repo.getSite(siteKey);
  if (!site) return null;
  return repo.listMessages(siteKey, BOARD_LIST_LIMIT);
}

export async function deleteBoardMessage(
  repo: Repo,
  siteKey: string,
  messageId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isSiteKey(siteKey) || !isMessageId(messageId)) {
    return { ok: false, status: 404, error: "Unknown message" };
  }
  const site = await repo.getSite(siteKey);
  if (!site) return { ok: false, status: 404, error: "Unknown site" };
  const removed = await repo.deleteMessage(siteKey, messageId);
  if (!removed) return { ok: false, status: 404, error: "Unknown message" };
  return { ok: true };
}

export async function openBoard(repo: Repo, siteKey: string, secret: string, now = new Date()): Promise<BoardOpenResult> {
  if (!isSiteKey(siteKey)) return { ok: false, status: 404, error: "closed" };
  const site = await repo.getSite(siteKey);
  if (!site || !site.guestbookEnabled) return { ok: true, enabled: false };
  if (!secret) return { ok: false, status: 500, error: "unavailable" };
  const messages = await repo.listMessages(siteKey, BOARD_LIST_LIMIT);
  return {
    ok: true,
    enabled: true,
    messages: messages.map(publishMessage),
    stamp: signBoardStamp(secret, siteKey, now.getTime()),
  };
}

export async function postBoard(
  repo: Repo,
  siteKey: string,
  raw: unknown,
  meta: CollectMeta,
  secret: string,
): Promise<BoardPostResult> {
  const body = readObject(raw);
  if (!body) return { ok: false, status: 400, error: "invalid" };
  if (!isSiteKey(siteKey)) return { ok: false, status: 404, error: "closed" };

  const site = await repo.getSite(siteKey);
  if (!site || !site.guestbookEnabled) return { ok: false, status: 404, error: "closed" };

  const company = typeof body.company === "string" ? body.company.trim() : "";
  if (company) return { ok: true };
  if (isBot(meta.userAgent ?? "")) return { ok: true };
  if (!secret) return { ok: false, status: 500, error: "unavailable" };

  const now = meta.now ?? new Date();
  const stamp = typeof body.stamp === "string" ? body.stamp : "";
  const age = boardStampAge(secret, stamp, siteKey, now.getTime());
  if (age === null || age > BOARD_STAMP_TTL_MS) return { ok: false, status: 400, error: "stamp" };
  if (age < BOARD_MIN_DELAY_MS) return { ok: false, status: 400, error: "wait" };

  const text = cleanBody(body.body);
  if (!text) return { ok: false, status: 400, error: "empty" };
  if (text.length > BOARD_MAX_BODY) return { ok: false, status: 400, error: "large" };
  const name = cleanName(body.name);

  const ip = clip(meta.ip, 64) || "unknown";
  const rate = await repo.getPostRate(siteKey, ip);
  const nowMs = now.getTime();
  if (rate && nowMs - rate.lastAt < BOARD_MIN_GAP_MS) return { ok: false, status: 429, error: "wait" };
  const inWindow = Boolean(rate && nowMs - rate.windowStart < BOARD_RATE_WINDOW_MS);
  if (rate && inWindow && rate.count >= BOARD_RATE_LIMIT) return { ok: false, status: 429, error: "rate" };
  if (rate && inWindow && rate.lastBody === text) return { ok: false, status: 429, error: "duplicate" };

  const message: MessageRecord = {
    siteKey,
    messageId: createMessageId(),
    name,
    body: text,
    createdAt: now.toISOString(),
    ip,
  };
  await repo.insertMessage(message);
  await repo.putPostRate({
    siteKey,
    ip,
    windowStart: rate && inWindow ? rate.windowStart : nowMs,
    count: rate && inWindow ? rate.count + 1 : 1,
    lastAt: nowMs,
    lastBody: text,
    ttl: ttlAfter(1, now),
  });

  return {
    ok: true,
    message: publishMessage(message),
    stamp: signBoardStamp(secret, siteKey, now.getTime()),
  };
}
