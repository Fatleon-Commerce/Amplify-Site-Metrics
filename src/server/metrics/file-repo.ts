import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { touchPageDay } from "./page-day";
import { compareSites, finiteOrder } from "./site-order";
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

function normalizeSite(site: SiteRecord): SiteRecord {
  const sortOrder = finiteOrder(site.sortOrder);
  const normalized: SiteRecord = { ...site, guestbookEnabled: site.guestbookEnabled === true };
  if (sortOrder === undefined) delete normalized.sortOrder;
  else normalized.sortOrder = sortOrder;
  return normalized;
}

export class FileRepo implements Repo {
  constructor(private readonly filePath: string) {}

  private async read(): Promise<Data> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<Data>;
      const now = Math.floor(Date.now() / 1000);
      return {
        sites: (parsed.sites ?? []).map(normalizeSite),
        visitors: (parsed.visitors ?? []).filter((item) => item.ttl > now),
        events: (parsed.events ?? []).filter((item) => item.ttl > now),
        days: (parsed.days ?? []).filter((item) => item.ttl > now),
        pages: (parsed.pages ?? []).filter((item) => item.ttl > now),
        messages: parsed.messages ?? [],
        rates: (parsed.rates ?? []).filter((item) => item.ttl > now),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty();
      throw error;
    }
  }

  private async write(data: Data): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(data));
    await rename(temporary, this.filePath);
  }

  async getSite(siteKey: string): Promise<SiteRecord | null> {
    const data = await this.read();
    return data.sites.find((site) => site.siteKey === siteKey) ?? null;
  }

  async createSite(site: SiteRecord): Promise<void> {
    const data = await this.read();
    if (data.sites.some((item) => item.siteKey === site.siteKey)) throw new Error("site exists");
    data.sites.push(site);
    await this.write(data);
  }

  async putSite(site: SiteRecord): Promise<void> {
    const data = await this.read();
    const index = data.sites.findIndex((item) => item.siteKey === site.siteKey);
    if (index === -1) data.sites.push(site);
    else data.sites[index] = site;
    await this.write(data);
  }

  async deleteSite(siteKey: string): Promise<void> {
    const data = await this.read();
    data.sites = data.sites.filter((site) => site.siteKey !== siteKey);
    data.visitors = data.visitors.filter((visitor) => visitor.siteKey !== siteKey);
    data.events = data.events.filter((event) => event.siteKey !== siteKey);
    data.days = data.days.filter((day) => day.siteKey !== siteKey);
    data.pages = data.pages.filter((page) => page.siteKey !== siteKey);
    data.messages = data.messages.filter((message) => message.siteKey !== siteKey);
    data.rates = data.rates.filter((rate) => rate.siteKey !== siteKey);
    await this.write(data);
  }

  async listSites(): Promise<SiteRecord[]> {
    const data = await this.read();
    return data.sites.slice().sort(compareSites);
  }

  async getVisitor(siteKey: string, visitorId: string): Promise<VisitorRecord | null> {
    const data = await this.read();
    return data.visitors.find((visitor) => visitor.siteKey === siteKey && visitor.visitorId === visitorId) ?? null;
  }

  async putVisitor(visitor: VisitorRecord): Promise<void> {
    const data = await this.read();
    const index = data.visitors.findIndex(
      (item) => item.siteKey === visitor.siteKey && item.visitorId === visitor.visitorId,
    );
    if (index === -1) data.visitors.push(visitor);
    else data.visitors[index] = visitor;
    await this.write(data);
  }

  async insertEvent(event: EventRecord): Promise<"ok" | "duplicate"> {
    const data = await this.read();
    const exists = data.events.some(
      (item) =>
        item.siteKey === event.siteKey &&
        item.visitorId === event.visitorId &&
        item.eventId === event.eventId,
    );
    if (exists) return "duplicate";
    data.events.push(event);
    await this.write(data);
    return "ok";
  }

  async saveEvent(event: EventRecord): Promise<void> {
    const data = await this.read();
    const index = data.events.findIndex(
      (item) =>
        item.siteKey === event.siteKey &&
        item.visitorId === event.visitorId &&
        item.eventId === event.eventId,
    );
    if (index === -1) data.events.push(event);
    else data.events[index] = event;
    await this.write(data);
  }

  async listEvents(
    siteKey: string,
    visitorId: string,
    limit: number,
    order: "asc" | "desc",
  ): Promise<EventRecord[]> {
    const data = await this.read();
    const rows = data.events
      .filter((event) => event.siteKey === siteKey && event.visitorId === visitorId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const ordered = order === "desc" ? rows.reverse() : rows;
    return ordered.slice(0, limit);
  }

  async listVisitors(siteKey: string, limit: number): Promise<VisitorRecord[]> {
    const data = await this.read();
    return data.visitors
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
    const data = await this.read();
    const current = data.days.find((day) => day.siteKey === siteKey && day.date === date);
    if (!current) data.days.push({ siteKey, date, pageviews, uniques, ttl });
    else {
      current.pageviews += pageviews;
      current.uniques += uniques;
      current.ttl = ttl;
    }
    await this.write(data);
  }

  async getDailies(siteKey: string, dates: string[]): Promise<DailyRecord[]> {
    const data = await this.read();
    const wanted = new Set(dates);
    return data.days.filter((day) => day.siteKey === siteKey && wanted.has(day.date));
  }

  async addPageDay(siteKey: string, date: string, path: string, delta: PageDayDelta, ttl: number): Promise<void> {
    const data = await this.read();
    touchPageDay(data.pages, siteKey, date, path, delta, ttl);
    await this.write(data);
  }

  async listPageDays(siteKey: string, from: string, to: string): Promise<PageDayRecord[]> {
    const data = await this.read();
    return data.pages.filter((page) => page.siteKey === siteKey && page.date >= from && page.date <= to);
  }

  async listMessages(siteKey: string, limit: number): Promise<MessageRecord[]> {
    const data = await this.read();
    return data.messages
      .filter((message) => message.siteKey === siteKey)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.messageId.localeCompare(a.messageId))
      .slice(0, limit);
  }

  async insertMessage(message: MessageRecord): Promise<void> {
    const data = await this.read();
    data.messages.push(message);
    await this.write(data);
  }

  async deleteMessage(siteKey: string, messageId: string): Promise<boolean> {
    const data = await this.read();
    const before = data.messages.length;
    data.messages = data.messages.filter((message) => message.siteKey !== siteKey || message.messageId !== messageId);
    if (data.messages.length === before) return false;
    await this.write(data);
    return true;
  }

  async getPostRate(siteKey: string, ip: string): Promise<PostRate | null> {
    const data = await this.read();
    return data.rates.find((rate) => rate.siteKey === siteKey && rate.ip === ip) ?? null;
  }

  async putPostRate(rate: PostRate): Promise<void> {
    const data = await this.read();
    const index = data.rates.findIndex((item) => item.siteKey === rate.siteKey && item.ip === rate.ip);
    if (index === -1) data.rates.push(rate);
    else data.rates[index] = rate;
    await this.write(data);
  }
}
