import path from "node:path";
import { FileRepo } from "./metrics/file-repo";
import {
  collectEvent,
  createNamedSite,
  listSiteSummaries,
  loadDetail,
  loadOverview,
  loadVisitors,
  loginWithPassword,
  removeSite,
  saveVisitorNote,
  tokenIsValid,
} from "./metrics/service";
import { AuthError, type MetricsBackend } from "./backend";
import type { CollectMeta, CollectResult, LoginResult, Overview, SiteSummary, VisitorDetail, VisitorRecord } from "./metrics/types";

let queue: Promise<unknown> = Promise.resolve();

function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export class FileBackend implements MetricsBackend {
  private readonly repo = new FileRepo(path.join(process.cwd(), ".data", "metrics.json"));

  private password(): string {
    return process.env.ADMIN_PASSWORD ?? "";
  }

  login(password: string, ip: string): Promise<LoginResult> {
    return loginWithPassword(this.password(), password, ip);
  }

  verify(token: string): Promise<boolean> {
    return Promise.resolve(tokenIsValid(this.password(), token));
  }

  siteExists(siteKey: string): Promise<boolean> {
    return serial(async () => Boolean(await this.repo.getSite(siteKey)));
  }

  collect(input: unknown, meta: CollectMeta): Promise<CollectResult> {
    return serial(() => collectEvent(this.repo, input, meta));
  }

  listSites(token: string): Promise<SiteSummary[]> {
    this.assertToken(token);
    return serial(() => listSiteSummaries(this.repo));
  }

  createSite(token: string, name: string) {
    this.assertToken(token);
    return serial(() => createNamedSite(this.repo, name));
  }

  deleteSite(token: string, siteKey: string) {
    this.assertToken(token);
    return serial(() => removeSite(this.repo, siteKey));
  }

  overview(token: string, siteKey: string): Promise<Overview | null> {
    this.assertToken(token);
    return serial(() => loadOverview(this.repo, siteKey));
  }

  visitors(token: string, siteKey: string): Promise<VisitorRecord[] | null> {
    this.assertToken(token);
    return serial(() => loadVisitors(this.repo, siteKey));
  }

  detail(token: string, siteKey: string, visitorId: string): Promise<VisitorDetail | null> {
    this.assertToken(token);
    return serial(() => loadDetail(this.repo, siteKey, visitorId));
  }

  saveNote(token: string, siteKey: string, visitorId: string, note: string, mark: string) {
    this.assertToken(token);
    return serial(() => saveVisitorNote(this.repo, siteKey, visitorId, note, mark));
  }

  private assertToken(token: string): void {
    if (!tokenIsValid(this.password(), token)) throw new AuthError();
  }
}
