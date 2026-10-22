import { touchPageDay } from "./page-day";
import { compareSites } from "./site-order";
import type {
  DailyRecord,
  EventRecord,
  MessageRecord,
  PageDayDelta,
  PageDayRecord,
  PostRate,
  Repo,
  SiteRecord,
  VisitorRecord,
} from "./types";

type Data = {
  sites: SiteRecord[];
  visitors: VisitorRecord[];
  events: EventRecord[];
  days: DailyRecord[];
  pages: PageDayRecord[];
  messages: MessageRecord[];
  rates: PostRate[];
};

function empty(): Data {
  return { sites: [], visitors: [], events: [], days: [], pages: [], messages: [], rates: [] };
}

export class MemoryRepo implements Repo {
  private data: Data = empty();

  async getSite(siteKey: string): Promise<SiteRecord | null> {
    return this.data.sites.find((site) => site.siteKey === siteKey) ?? null;
  }

  async createSite(site: SiteRecord): Promise<void> {
    if (await this.getSite(site.siteKey)) throw new Error("site exists");
    this.data.sites.push(site);
  }

  async putSite(site: SiteRecord): Promise<void> {
    const index = this.data.sites.findIndex((item) => item.siteKey === site.siteKey);
    if (index === -1) this.data.sites.push(site);
    else this.data.sites[index] = site;
  }

  async deleteSite(siteKey: string): Promise<void> {
    this.data.sites = this.data.sites.filter((site) => site.siteKey !== siteKey);
    this.data.messages = this.data.messages.filter((message) => message.siteKey !== siteKey);
    this.data.rates = this.data.rates.filter((rate) => rate.siteKey !== siteKey);
  }

  async listSites(): Promise<SiteRecord[]> {
    return [...this.data.sites].sort(compareSites);
  }

  async getVisitor(siteKey: string, visitorId: string): Promise<VisitorRecord | null> {
    return (
      this.data.visitors.find((visitor) => visitor.siteKey === siteKey && visitor.visitorId === visitorId) ??
      null
    );
  }

  async putVisitor(visitor: VisitorRecord): Promise<void> {
    const index = this.data.visitors.findIndex(
      (item) => item.siteKey === visitor.siteKey && item.visitorId === visitor.visitorId,
    );
    if (index === -1) this.data.visitors.push(visitor);
    else this.data.visitors[index] = visitor;
  }

  async insertEvent(event: EventRecord): Promise<"ok" | "duplicate"> {
    const exists = this.data.events.some(
      (item) =>
        item.siteKey === event.siteKey &&
        item.visitorId === event.visitorId &&
        item.eventId === event.eventId,
    );
    if (exists) return "duplicate";
    this.data.events.push(event);
    return "ok";
  }

  async saveEvent(event: EventRecord): Promise<void> {
    const index = this.data.events.findIndex(
      (item) =>
        item.siteKey === event.siteKey &&
        item.visitorId === event.visitorId &&
        item.eventId === event.eventId,
    );
    if (index === -1) this.data.events.push(event);
    else this.data.events[index] = event;
  }

  async listEvents(
    siteKey: string,
    visitorId: string,
    limit: number,
    order: "asc" | "desc",
  ): Promise<EventRecord[]> {
    const rows = this.data.events
      .filter((event) => event.siteKey === siteKey && event.visitorId === visitorId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const ordered = order === "desc" ? rows.reverse() : rows;
    return ordered.slice(0, limit);
  }

  async listVisitors(siteKey: string, limit: number): Promise<VisitorRecord[]> {
    return this.data.visitors
      .filter((visitor) => visitor.siteKey === siteKey)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, limit);
  }

  async addDaily(
    siteKey: string,
    date: string,
    pageviews: number,
    uniques: number,
    ttl: number,
  ): Promise<void> {
    const current = this.data.days.find((day) => day.siteKey === siteKey && day.date === date);
    if (!current) {
      this.data.days.push({ siteKey, date, pageviews, uniques, ttl });
      return;
    }
    current.pageviews += pageviews;
    current.uniques += uniques;
    current.ttl = ttl;
  }

  async getDailies(siteKey: string, dates: string[]): Promise<DailyRecord[]> {
    const wanted = new Set(dates);
    return this.data.days.filter((day) => day.siteKey === siteKey && wanted.has(day.date));
  }

  async addPageDay(siteKey: string, date: string, path: string, delta: PageDayDelta, ttl: number): Promise<void> {
    touchPageDay(this.data.pages, siteKey, date, path, delta, ttl);
  }

  async listPageDays(siteKey: string, from: string, to: string): Promise<PageDayRecord[]> {
    return this.data.pages.filter((page) => page.siteKey === siteKey && page.date >= from && page.date <= to);
  }

  async listMessages(siteKey: string, limit: number): Promise<MessageRecord[]> {
    return this.data.messages
      .filter((message) => message.siteKey === siteKey)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.messageId.localeCompare(a.messageId))
      .slice(0, limit);
  }

  async insertMessage(message: MessageRecord): Promise<void> {
    this.data.messages.push(message);
  }

  async deleteMessage(siteKey: string, messageId: string): Promise<boolean> {
    const before = this.data.messages.length;
    this.data.messages = this.data.messages.filter(
      (message) => message.siteKey !== siteKey || message.messageId !== messageId,
    );
    return this.data.messages.length !== before;
  }

  async getPostRate(siteKey: string, ip: string): Promise<PostRate | null> {
    return this.data.rates.find((rate) => rate.siteKey === siteKey && rate.ip === ip) ?? null;
  }

  async putPostRate(rate: PostRate): Promise<void> {
    const index = this.data.rates.findIndex((item) => item.siteKey === rate.siteKey && item.ip === rate.ip);
    if (index === -1) this.data.rates.push(rate);
    else this.data.rates[index] = rate;
  }
}
