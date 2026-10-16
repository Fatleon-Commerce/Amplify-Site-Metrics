import { DAILY_TTL_DAYS, EVENT_TTL_DAYS, MAX_DURATION_MS, VISIT_GAP_MS } from "../../lib/constants";
import { clip, createSiteKey, dayKey, isClientId, isSiteKey, recentDayKeys, ttlAfter } from "./ids";
import { clampOccurredAt, isBot, parseDevice, trafficSource } from "./parse";
import {
  clearLoginAttempts,
  passwordsMatch,
  recordLoginFailure,
  signToken,
  tooManyLogins,
  verifyToken,
} from "./token";
import type {
  CollectMeta,
  CollectResult,
  EventRecord,
  LoginResult,
  Overview,
  Repo,
  SiteRecord,
  SiteSummary,
  VisitorDetail,
  VisitorRecord,
} from "./types";

const RATE_LIMIT = 60;

function readObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function blankVisitor(input: {
  siteKey: string;
  visitorId: string;
  sessionId: string;
  occurredAt: string;
  path: string;
  referrer: string;
  source: string;
  meta: CollectMeta;
  now: Date;
  locale: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}): VisitorRecord {
  return {
    siteKey: input.siteKey,
    visitorId: input.visitorId,
    firstSeenAt: input.occurredAt,
    lastSeenAt: input.occurredAt,
    firstReferrer: input.referrer,
    trafficSource: input.source,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    landingPath: input.path,
    lastPath: input.path,
    ip: clip(input.meta.ip, 64),
    country: clip(input.meta.country, 8).toUpperCase(),
    city: clip(input.meta.city, 80),
    userAgent: clip(input.meta.userAgent, 300),
    device: parseDevice(input.meta.userAgent ?? ""),
    locale: input.locale,
    pageCount: 0,
    visitCount: 0,
    currentSessionId: input.sessionId,
    activeMs: 0,
    countedDay: "",
    ttl: ttlAfter(EVENT_TTL_DAYS, input.now),
    rateWindowMinute: 0,
    rateCount: 0,
  };
}

export async function loginWithPassword(
  password: string,
  attempt: string,
  ip: string,
): Promise<LoginResult> {
  if (!password) {
    return { ok: false, status: 500, error: "ADMIN_PASSWORD is not configured" };
  }
  if (tooManyLogins(ip || "unknown")) {
    return { ok: false, status: 429, error: "Too many attempts. Try again later." };
  }
  if (!passwordsMatch(attempt, password)) {
    recordLoginFailure(ip || "unknown");
    return { ok: false, status: 401, error: "Incorrect password" };
  }
  clearLoginAttempts(ip || "unknown");
  return { ok: true, token: signToken(password) };
}

export function tokenIsValid(password: string, token: string): boolean {
  return verifyToken(password, token);
}

export async function createNamedSite(repo: Repo, name: string, now = new Date()): Promise<
  { ok: true; siteKey: string } | { ok: false; error: string }
> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 40) {
    return { ok: false, error: "Enter a site name of 1 to 40 characters" };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const siteKey = createSiteKey();
    const site: SiteRecord = {
      siteKey,
      name: trimmed,
      createdAt: now.toISOString(),
      pageviewCount: 0,
      visitorCount: 0,
    };
    try {
      await repo.createSite(site);
      return { ok: true, siteKey };
    } catch {
      const existing = await repo.getSite(siteKey);
      if (!existing) throw new Error("Could not create the site");
    }
  }

  return { ok: false, error: "Could not create the site. Try again." };
}

export async function removeSite(repo: Repo, siteKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const site = await repo.getSite(siteKey);
  if (!site) return { ok: false, error: "Unknown site" };
  await repo.deleteSite(siteKey);
  return { ok: true };
}

export async function listSiteSummaries(repo: Repo, now = new Date()): Promise<SiteSummary[]> {
  const sites = await repo.listSites();
  const today = dayKey(now);
  const summaries: SiteSummary[] = [];
  for (const site of sites) {
    const days = await repo.getDailies(site.siteKey, [today]);
    const current = days[0];
    summaries.push({
      ...site,
      todayPageviews: current?.pageviews ?? 0,
      todayUniques: current?.uniques ?? 0,
    });
  }
  return summaries;
}

export async function loadOverview(repo: Repo, siteKey: string, now = new Date()): Promise<Overview | null> {
  const site = await repo.getSite(siteKey);
  if (!site) return null;
  const dates = recentDayKeys(7, now);
  const rows = await repo.getDailies(siteKey, dates);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const days = dates.map((date) => ({
    date,
    pageviews: byDate.get(date)?.pageviews ?? 0,
    uniques: byDate.get(date)?.uniques ?? 0,
  }));
  const today = days[days.length - 1] ?? { pageviews: 0, uniques: 0 };
  return {
    site,
    todayPageviews: today.pageviews,
    todayUniques: today.uniques,
    last7Pageviews: days.reduce((sum, day) => sum + day.pageviews, 0),
    days,
  };
}

export async function loadVisitors(repo: Repo, siteKey: string): Promise<VisitorRecord[] | null> {
  const site = await repo.getSite(siteKey);
  if (!site) return null;
  return repo.listVisitors(siteKey, 200);
}

export async function loadDetail(
  repo: Repo,
  siteKey: string,
  visitorId: string,
): Promise<VisitorDetail | null> {
  const site = await repo.getSite(siteKey);
  if (!site) return null;
  const visitor = await repo.getVisitor(siteKey, visitorId);
  if (!visitor) return null;
  const events = (await repo.listEvents(siteKey, visitorId, 300, "desc")).reverse();
  return { site, visitor, events };
}

export async function collectEvent(repo: Repo, raw: unknown, meta: CollectMeta): Promise<CollectResult> {
  const body = readObject(raw);
  if (!body) return { ok: false, status: 400, error: "Invalid JSON" };

  const op = body.op;
  const siteKey = clip(body.siteKey, 16);
  const visitorId = clip(body.visitorId, 64);
  const sessionId = clip(body.sessionId, 64);
  const eventId = clip(body.eventId, 64);
  if (op !== "pageview" && op !== "pageleave") {
    return { ok: false, status: 400, error: "Unsupported event" };
  }
  if (!isSiteKey(siteKey) || !isClientId(visitorId) || !isClientId(sessionId) || !isClientId(eventId)) {
    return { ok: false, status: 400, error: "Invalid identifiers" };
  }
  if (isBot(meta.userAgent ?? "")) return { ok: true };

  const site = await repo.getSite(siteKey);
  if (!site) return { ok: false, status: 404, error: "Unknown site" };

  const now = meta.now ?? new Date();
  const occurredAt = clampOccurredAt(clip(body.occurredAt, 40), now);

  if (op === "pageleave") {
    await applyPageLeave(repo, {
      siteKey,
      visitorId,
      eventId,
      occurredAt,
      durationMs: Number(body.durationMs),
      now,
    });
    return { ok: true };
  }

  const minute = Math.floor(now.getTime() / 60000);
  const existing = await repo.getVisitor(siteKey, visitorId);
  if (existing && existing.rateWindowMinute === minute && existing.rateCount >= RATE_LIMIT) {
    return { ok: true };
  }

  const path = clip(body.path, 300) || "/";
  const title = clip(body.title, 120);
  const referrer = clip(body.referrer, 500);
  const locale = clip(body.lang, 20);
  const utmSource = clip(body.utmSource, 80);
  const utmMedium = clip(body.utmMedium, 80);
  const utmCampaign = clip(body.utmCampaign, 80);
  const inserted = await repo.insertEvent({
    siteKey,
    visitorId,
    eventId,
    sessionId,
    occurredAt,
    path,
    title,
    durationMs: -1,
    ttl: ttlAfter(EVENT_TTL_DAYS, now),
  });
  if (inserted === "duplicate") return { ok: true };

  const visitor =
    existing ??
    blankVisitor({
      siteKey,
      visitorId,
      sessionId,
      occurredAt,
      path,
      referrer,
      source: trafficSource(referrer),
      meta,
      now,
      locale,
      utmSource,
      utmMedium,
      utmCampaign,
    });

  const seenAt = new Date(occurredAt).getTime();
  const previousSeen = existing ? new Date(existing.lastSeenAt).getTime() : seenAt;
  const gap = seenAt - previousSeen;
  const newVisit = !existing || sessionId !== existing.currentSessionId || gap > VISIT_GAP_MS;
  const today = dayKey(new Date(occurredAt));
  const countUnique = visitor.countedDay !== today;

  visitor.lastSeenAt = occurredAt;
  visitor.lastPath = path;
  visitor.pageCount += 1;
  visitor.visitCount = existing ? visitor.visitCount + (newVisit ? 1 : 0) : 1;
  visitor.currentSessionId = sessionId;
  visitor.ttl = ttlAfter(EVENT_TTL_DAYS, now);
  visitor.ip = clip(meta.ip, 64) || visitor.ip;
  visitor.country = clip(meta.country, 8).toUpperCase() || visitor.country;
  visitor.city = clip(meta.city, 80) || visitor.city;
  visitor.userAgent = clip(meta.userAgent, 300) || visitor.userAgent;
  visitor.device = parseDevice(visitor.userAgent);
  visitor.locale = locale || visitor.locale;
  if (!visitor.firstReferrer && referrer) {
    visitor.firstReferrer = referrer;
    visitor.trafficSource = trafficSource(referrer);
  }
  if (!visitor.utmSource && utmSource) visitor.utmSource = utmSource;
  if (!visitor.utmMedium && utmMedium) visitor.utmMedium = utmMedium;
  if (!visitor.utmCampaign && utmCampaign) visitor.utmCampaign = utmCampaign;
  if (!visitor.landingPath) visitor.landingPath = path;
  visitor.countedDay = today;
  visitor.rateWindowMinute = minute;
  visitor.rateCount = existing && existing.rateWindowMinute === minute ? existing.rateCount + 1 : 1;
  await repo.putVisitor(visitor);

  site.pageviewCount += 1;
  if (!existing) site.visitorCount += 1;
  await repo.putSite(site);
  await repo.addDaily(siteKey, today, 1, countUnique ? 1 : 0, ttlAfter(DAILY_TTL_DAYS, now));
  return { ok: true };
}

async function applyPageLeave(
  repo: Repo,
  input: {
    siteKey: string;
    visitorId: string;
    eventId: string;
    occurredAt: string;
    durationMs: number;
    now: Date;
  },
): Promise<void> {
  if (!Number.isFinite(input.durationMs)) return;
  const durationMs = Math.max(0, Math.min(MAX_DURATION_MS, Math.round(input.durationMs)));
  const recent = await repo.listEvents(input.siteKey, input.visitorId, 40, "desc");
  const event = recent.find((item) => item.eventId === input.eventId);
  if (!event) return;
  const previous = event.durationMs >= 0 ? event.durationMs : 0;
  event.durationMs = durationMs;
  await repo.saveEvent(event);

  const visitor = await repo.getVisitor(input.siteKey, input.visitorId);
  if (!visitor) return;
  visitor.activeMs = Math.max(0, visitor.activeMs + durationMs - previous);
  if (input.occurredAt > visitor.lastSeenAt) visitor.lastSeenAt = input.occurredAt;
  visitor.ttl = ttlAfter(EVENT_TTL_DAYS, input.now);
  await repo.putVisitor(visitor);
}
