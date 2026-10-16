import { AuthError, type MetricsBackend } from "./backend";
import type {
  CollectMeta,
  CollectResult,
  LoginResult,
  Overview,
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
  visitors?: VisitorRecord[];
  detail?: VisitorDetail;
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

  async siteExists(siteKey: string): Promise<boolean> {
    const { json } = await this.call({ op: "siteExists", siteKey });
    return Boolean(json.exists);
  }

  async collect(input: unknown, meta: CollectMeta): Promise<CollectResult> {
    const { status, json } = await this.call({ op: "collect", input, meta });
    if (json.ok) return { ok: true };
    return { ok: false, status, error: json.error ?? "collect failed" };
  }

  async listSites(token: string): Promise<SiteSummary[]> {
    const { json } = await this.call({ op: "listSites" }, token);
    return json.sites ?? [];
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
    return json.overview ?? null;
  }

  async visitors(token: string, siteKey: string): Promise<VisitorRecord[] | null> {
    const { status, json } = await this.call({ op: "visitors", siteKey }, token);
    if (status === 404) return null;
    return json.visitors ?? null;
  }

  async detail(token: string, siteKey: string, visitorId: string): Promise<VisitorDetail | null> {
    const { status, json } = await this.call({ op: "detail", siteKey, visitorId }, token);
    if (status === 404) return null;
    return json.detail ?? null;
  }
}
