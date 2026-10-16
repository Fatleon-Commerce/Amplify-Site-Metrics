export type SiteRecord = {
  siteKey: string;
  name: string;
  createdAt: string;
  pageviewCount: number;
  visitorCount: number;
};

export type VisitorRecord = {
  siteKey: string;
  visitorId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  firstReferrer: string;
  trafficSource: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  landingPath: string;
  lastPath: string;
  ip: string;
  country: string;
  city: string;
  userAgent: string;
  device: string;
  locale: string;
  pageCount: number;
  visitCount: number;
  currentSessionId: string;
  activeMs: number;
  countedDay: string;
  ttl: number;
  rateWindowMinute: number;
  rateCount: number;
  note: string;
  mark: string;
};

export type EventRecord = {
  siteKey: string;
  visitorId: string;
  eventId: string;
  sessionId: string;
  occurredAt: string;
  path: string;
  title: string;
  durationMs: number;
  ttl: number;
};

export type DailyRecord = {
  siteKey: string;
  date: string;
  pageviews: number;
  uniques: number;
  ttl: number;
};

export type PageDayRecord = {
  siteKey: string;
  date: string;
  path: string;
  pageviews: number;
  ttl: number;
};

export type SiteSummary = SiteRecord & {
  todayPageviews: number;
  todayUniques: number;
};

export type Overview = {
  site: SiteRecord;
  todayPageviews: number;
  todayUniques: number;
  last7Pageviews: number;
  days: Array<{ date: string; pageviews: number; uniques: number }>;
  pageDays: Array<{ date: string; pages: Array<{ path: string; pageviews: number }> }>;
};

export type VisitorDetail = {
  site: SiteRecord;
  visitor: VisitorRecord;
  events: EventRecord[];
};

export type CollectMeta = {
  ip?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  now?: Date;
};

export type CollectResult = { ok: true } | { ok: false; status: number; error: string };

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; status: number; error: string };

export interface Repo {
  getSite(siteKey: string): Promise<SiteRecord | null>;
  createSite(site: SiteRecord): Promise<void>;
  putSite(site: SiteRecord): Promise<void>;
  deleteSite(siteKey: string): Promise<void>;
  listSites(): Promise<SiteRecord[]>;
  getVisitor(siteKey: string, visitorId: string): Promise<VisitorRecord | null>;
  putVisitor(visitor: VisitorRecord): Promise<void>;
  insertEvent(event: EventRecord): Promise<"ok" | "duplicate">;
  saveEvent(event: EventRecord): Promise<void>;
  listEvents(
    siteKey: string,
    visitorId: string,
    limit: number,
    order: "asc" | "desc",
  ): Promise<EventRecord[]>;
  listVisitors(siteKey: string, limit: number): Promise<VisitorRecord[]>;
  addDaily(siteKey: string, date: string, pageviews: number, uniques: number, ttl: number): Promise<void>;
  getDailies(siteKey: string, dates: string[]): Promise<DailyRecord[]>;
  addPageDay(siteKey: string, date: string, path: string, pageviews: number, ttl: number): Promise<void>;
  listPageDays(siteKey: string, from: string, to: string): Promise<PageDayRecord[]>;
}
