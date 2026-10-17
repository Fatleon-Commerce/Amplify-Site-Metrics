import { readFileSync } from "node:fs";
import path from "node:path";
import type { BoardOpenResult, BoardPostResult } from "./metrics/board";
import type { CollectMeta, CollectResult, LoginResult, MessageRecord, Overview, PageReport, SiteSummary, VisitorDetail, VisitorRecord } from "./metrics/types";

export class AuthError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "AuthError";
  }
}

export interface MetricsBackend {
  login(password: string, ip: string): Promise<LoginResult>;
  verify(token: string): Promise<boolean>;
  siteConfig(siteKey: string): Promise<{ guestbookEnabled: boolean } | null>;
  collect(input: unknown, meta: CollectMeta): Promise<CollectResult>;
  openBoard(siteKey: string): Promise<BoardOpenResult>;
  postBoard(siteKey: string, input: unknown, meta: CollectMeta): Promise<BoardPostResult>;
  setGuestbook(token: string, siteKey: string, enabled: boolean): Promise<{ ok: true } | { ok: false; error: string }>;
  boardMessages(token: string, siteKey: string): Promise<MessageRecord[] | null>;
  deleteBoardMessage(
    token: string,
    siteKey: string,
    messageId: string,
  ): Promise<{ ok: true } | { ok: false; status: number; error: string }>;
  listSites(token: string): Promise<SiteSummary[]>;
  createSite(token: string, name: string): Promise<{ ok: true; siteKey: string } | { ok: false; error: string }>;
  deleteSite(token: string, siteKey: string): Promise<{ ok: true } | { ok: false; error: string }>;
  overview(token: string, siteKey: string): Promise<Overview | null>;
  pages(token: string, siteKey: string, from: string, to: string): Promise<PageReport | null>;
  visitors(token: string, siteKey: string): Promise<VisitorRecord[] | null>;
  detail(token: string, siteKey: string, visitorId: string): Promise<VisitorDetail | null>;
  saveNote(
    token: string,
    siteKey: string,
    visitorId: string,
    note: string,
    mark: string,
  ): Promise<{ ok: true } | { ok: false; status: number; error: string }>;
}

export function metricsApiUrl(): string {
  if (process.env.STORE === "file") return "";
  if (process.env.METRICS_API_URL) return process.env.METRICS_API_URL;
  const file = path.join(process.cwd(), "amplify_outputs.json");
  try {
    const json = JSON.parse(readFileSync(file, "utf8")) as { custom?: { metricsApiUrl?: string } };
    return json.custom?.metricsApiUrl ?? "";
  } catch {
    return "";
  }
}

let backend: MetricsBackend | undefined;

export async function getBackend(): Promise<MetricsBackend> {
  if (!backend) {
    const url = metricsApiUrl();
    if (url) {
      const { RemoteBackend } = await import("./remote-backend");
      backend = new RemoteBackend(url);
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("METRICS_API_URL is not configured");
    } else {
      const { FileBackend } = await import("./file-backend");
      backend = new FileBackend();
    }
  }
  return backend;
}

export function resetBackendForTests(): void {
  backend = undefined;
}
