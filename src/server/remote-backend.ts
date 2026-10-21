import { AuthError, type MetricsBackend } from "./backend";
import type { BoardOpenResult, BoardPostResult } from "./metrics/board";
import { publishMessage } from "./metrics/board";
import type {
  CollectMeta,
  CollectResult,
  LoginResult,
  MessageRecord,
  Overview,
  PageDetail,
  PageReport,
  SiteSummary,
  VisitorDetail,
  VisitorRecord,
} from "./metrics/types";

type Envelope = {
  ok?: boolean;
  error?: string;
  token?: string;
  exists?: boolean;
  siteKey?: string;
  sites?: SiteSummary[];
  overview?: Overview;
  report?: PageReport;
  page?: PageDetail;
  visitors?: VisitorRecord[];
  detail?: VisitorDetail;
  guestbookEnabled?: boolean;
  enabled?: boolean;
  messages?: MessageRecord[];
  message?: MessageRecord;
  stamp?: string;
};

export class RemoteBackend implements MetricsBackend {
  constructor(private readonly url: string) {}

  private async call(body: Record<string, unknown>, token?: string): Promise<{ status: number; json: Envelope }> {
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(token ? { ...body, token } : body),
        cache: "no-store",
      });
      const json = (await response.json().catch(() => ({}))) as Envelope;
      if (response.status === 401 && token) throw new AuthError();
      return { status: response.status, json };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new Error("Analytics service is unreachable");
    }
  }

  async login(password: string, ip: string): Promise<LoginResult> {
    const { status, json } = await this.call({ op: "login", password, ip });
    if (json.ok && json.token) return { ok: true, token: json.token };
    return { ok: false, status, error: json.error ?? "Sign-in failed" };
  }

  async verify(token: string): Promise<boolean> {
    try {
      const { json } = await this.call({ op: "verify" }, token);
      return Boolean(json.ok);
    } catch (error) {
      if (error instanceof AuthError) return false;
      throw error;
    }
  }

  async siteConfig(siteKey: string): Promise<{ guestbookEnabled: boolean } | null> {
    const { json } = await this.call({ op: "siteConfig", siteKey });
    if (!json.exists) return null;
    return { guestbookEnabled: json.guestbookEnabled === true };
  }

  async openBoard(siteKey: string): Promise<BoardOpenResult> {
    const { status, json } = await this.call({ op: "boardOpen", siteKey });
    if (json.ok && json.enabled === false) return { ok: true, enabled: false };
    if (json.ok && json.enabled === true && json.stamp) {
      return {
        ok: true,
        enabled: true,
        messages: (json.messages ?? []).map(publishMessage),
        stamp: json.stamp,
      };
    }
    return { ok: false, status, error: json.error ?? "Could not open the guestbook" };
  }

  async postBoard(siteKey: string, input: unknown, meta: CollectMeta): Promise<BoardPostResult> {
    const { status, json } = await this.call({ op: "boardPost", siteKey, input, meta });
    if (json.ok && json.message && json.stamp) {
      return { ok: true, message: publishMessage(json.message), stamp: json.stamp };
    }
    if (json.ok) return { ok: true };
    return { ok: false, status, error: json.error ?? "Could not save the message" };
  }

  setGuestbook(token: string, siteKey: string, enabled: boolean) {
    return this.call({ op: "setGuestbook", siteKey, enabled }, token).then(({ json }) => {
      if (json.ok) return { ok: true as const };
      return { ok: false as const, error: json.error ?? "Could not update the guestbook" };
    });
  }

  async boardMessages(token: string, siteKey: string): Promise<MessageRecord[] | null> {
    const { status, json } = await this.call({ op: "boardMessages", siteKey }, token);
    if (status === 404) return null;
    if (status !== 200 || !json.messages) throw new Error(json.error ?? "Could not load messages");
    return json.messages;
  }

  deleteBoardMessage(token: string, siteKey: string, messageId: string) {
    return this.call({ op: "deleteBoardMessage", siteKey, messageId }, token).then(({ status, json }) => {
      if (json.ok) return { ok: true as const };
      return { ok: false as const, status, error: json.error ?? "Could not delete the message" };
    });
  }

  async collect(input: unknown, meta: CollectMeta): Promise<CollectResult> {
    const { status, json } = await this.call({ op: "collect", input, meta });
    if (json.ok) return { ok: true };
    return { ok: false, status, error: json.error ?? "collect failed" };
  }

  async listSites(token: string): Promise<SiteSummary[]> {
    const { status, json } = await this.call({ op: "listSites" }, token);
    if (status !== 200 || !json.sites) throw new Error(json.error ?? "Could not load sites");
    return json.sites;
  }

  createSite(token: string, name: string) {
    return this.call({ op: "createSite", name }, token).then(({ json }) => {
      if (json.ok && json.siteKey) return { ok: true as const, siteKey: json.siteKey };
      return { ok: false as const, error: json.error ?? "Could not create the site" };
    });
  }

  deleteSite(token: string, siteKey: string) {
    return this.call({ op: "deleteSite", siteKey }, token).then(({ json }) => {
      if (json.ok) return { ok: true as const };
      return { ok: false as const, error: json.error ?? "Could not delete the site" };
    });
  }

  async overview(token: string, siteKey: string): Promise<Overview | null> {
    const { status, json } = await this.call({ op: "overview", siteKey }, token);
    if (status === 404) return null;
    if (status !== 200 || !json.overview) throw new Error(json.error ?? "Could not load the site");
    return json.overview;
  }

  async pages(token: string, siteKey: string, from: string, to: string): Promise<PageReport | null> {
    const { status, json } = await this.call({ op: "pages", siteKey, from, to }, token);
    if (status === 404) return null;
    if (status !== 200 || !json.report) throw new Error(json.error ?? "Could not load pages");
    return json.report;
  }

  async pageDetail(
    token: string,
    siteKey: string,
    path: string,
    from: string,
    to: string,
  ): Promise<PageDetail | null> {
    const { status, json } = await this.call({ op: "page", siteKey, path, from, to }, token);
    if (status === 404) return null;
    if (status !== 200 || !json.page) throw new Error(json.error ?? "Could not load the page");
    return json.page;
  }

  async visitors(token: string, siteKey: string): Promise<VisitorRecord[] | null> {
    const { status, json } = await this.call({ op: "visitors", siteKey }, token);
    if (status === 404) return null;
    if (status !== 200 || !json.visitors) throw new Error(json.error ?? "Could not load visitors");
    return json.visitors;
  }

  async detail(token: string, siteKey: string, visitorId: string): Promise<VisitorDetail | null> {
    const { status, json } = await this.call({ op: "detail", siteKey, visitorId }, token);
    if (status === 404) return null;
    if (status !== 200 || !json.detail) throw new Error(json.error ?? "Could not load the visitor");
    return json.detail;
  }

  saveNote(token: string, siteKey: string, visitorId: string, note: string, mark: string) {
    return this.call({ op: "saveNote", siteKey, visitorId, note, mark }, token).then(({ status, json }) => {
      if (json.ok) return { ok: true as const };
      return { ok: false as const, status, error: json.error ?? "Could not save the note" };
    });
  }
}
