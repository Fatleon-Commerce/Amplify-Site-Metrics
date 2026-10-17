import path from "node:path";
import { FileRepo } from "./metrics/file-repo";
import {
  deleteBoardMessage as removeBoardMessage,
  loadBoardMessages,
  openBoard as readBoard,
  postBoard as submitBoard,
  setGuestbookEnabled,
} from "./metrics/board";
import {
  collectEvent,
  createNamedSite,
  listSiteSummaries,
  loadDetail,
  loadOverview,
  loadPageReport,
  loadVisitors,
  loginWithPassword,
  removeSite,
  saveVisitorNote,
  tokenIsValid,
} from "./metrics/service";
import { AuthError, type MetricsBackend } from "./backend";
import type { CollectMeta, CollectResult, LoginResult, Overview, PageReport, SiteSummary, VisitorDetail, VisitorRecord } from "./metrics/types";

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

  siteConfig(siteKey: string): Promise<{ guestbookEnabled: boolean } | null> {
    return serial(async () => {
      const site = await this.repo.getSite(siteKey);
      if (!site) return null;
      return { guestbookEnabled: site.guestbookEnabled === true };
    });
  }

  openBoard(siteKey: string) {
    return serial(() => readBoard(this.repo, siteKey, this.password()));
  }

  postBoard(siteKey: string, input: unknown, meta: CollectMeta) {
    return serial(() => submitBoard(this.repo, siteKey, input, meta, this.password()));
  }

  setGuestbook(token: string, siteKey: string, enabled: boolean) {
    this.assertToken(token);
    return serial(() => setGuestbookEnabled(this.repo, siteKey, enabled));
  }

  boardMessages(token: string, siteKey: string) {
    this.assertToken(token);
    return serial(() => loadBoardMessages(this.repo, siteKey));
  }

  deleteBoardMessage(token: string, siteKey: string, messageId: string) {
    this.assertToken(token);
    return serial(() => removeBoardMessage(this.repo, siteKey, messageId));
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

  pages(token: string, siteKey: string, from: string, to: string): Promise<PageReport | null> {
    this.assertToken(token);
    return serial(() => loadPageReport(this.repo, siteKey, from, to));
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
