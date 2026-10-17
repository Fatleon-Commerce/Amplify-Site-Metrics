import assert from "node:assert/strict";
import test from "node:test";
import { trackerScript } from "./script";
import { MemoryRepo } from "./memory-repo";
import { parseDevice, trafficSource } from "./parse";
import {
  collectEvent,
  createNamedSite,
  listSiteSummaries,
  loadDetail,
  loadOverview,
  loadPageReport,
  loginWithPassword,
  pagePath,
  saveVisitorNote,
} from "./service";
import { resetLoginAttempts, signToken, verifyToken } from "./token";
import type { Repo } from "./types";

const NOW = new Date("2026-10-16T02:00:00.000Z");
const VISITOR = "visitor1234567890abcd";
const SESSION = "session1234567890";

async function site(repo: Repo): Promise<string> {
  const created = await createNamedSite(repo, "Example site", NOW);
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("site");
  return created.siteKey;
}

function view(eventId: string, extra: Record<string, unknown> = {}) {
  return {
    op: "pageview",
    visitorId: VISITOR,
    sessionId: SESSION,
    eventId,
    path: "/pricing",
    title: "Pricing",
    referrer: "https://www.google.com/search?q=kit",
    occurredAt: NOW.toISOString(),
    lang: "zh-CN",
    ...extra,
  };
}

test("login, token, and repeated failures", async () => {
  resetLoginAttempts();
  const denied = await loginWithPassword("secret-pass", "nope", "203.0.113.8");
  assert.equal(denied.ok, false);
  const allowed = await loginWithPassword("secret-pass", "secret-pass", "203.0.113.9");
  assert.equal(allowed.ok, true);
  if (!allowed.ok) return;
  assert.equal(verifyToken("secret-pass", allowed.token, NOW.getTime()), true);
  assert.equal(verifyToken("secret-pass", `${allowed.token}x`, NOW.getTime()), false);
  const expired = signToken("secret-pass", NOW.getTime() - 1000);
  assert.equal(verifyToken("secret-pass", expired, NOW.getTime()), false);

  resetLoginAttempts();
  for (let index = 0; index < 8; index += 1) {
    await loginWithPassword("secret-pass", "wrong", "203.0.113.10");
  }
  const blocked = await loginWithPassword("secret-pass", "secret-pass", "203.0.113.10");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 429);
});

test("pageviews build a visitor, a path, and daily counts", async () => {
  const repo = new MemoryRepo();
  const siteKey = await site(repo);
  const first = await collectEvent(repo, view("event0001", { siteKey }), {
    now: NOW,
    ip: "203.0.113.5",
    country: "cn",
    city: "Shanghai",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  });
  assert.deepEqual(first, { ok: true });

  const later = new Date(NOW.getTime() + 2 * 60 * 1000);
  const second = await collectEvent(
    repo,
    view("event0002", {
      siteKey,
      path: "/docs",
      title: "Docs",
      referrer: "https://www.baidu.com/",
      occurredAt: later.toISOString(),
    }),
    { now: later },
  );
  assert.deepEqual(second, { ok: true });

  const duplicate = await collectEvent(repo, view("event0002", { siteKey, occurredAt: later.toISOString() }), {
    now: later,
  });
  assert.deepEqual(duplicate, { ok: true });

  const detail = await loadDetail(repo, siteKey, VISITOR);
  assert.ok(detail);
  assert.equal(detail?.visitor.visitCount, 1);
  assert.equal(detail?.visitor.pageCount, 2);
  assert.equal(detail?.visitor.trafficSource, "google");
  assert.equal(detail?.visitor.country, "CN");
  assert.equal(detail?.visitor.device, "macOS · Chrome");
  assert.deepEqual(
    detail?.events.map((event) => event.path),
    ["/pricing", "/docs"],
  );

  const overview = await loadOverview(repo, siteKey, later);
  assert.equal(overview?.todayPageviews, 2);
  assert.equal(overview?.todayUniques, 1);
  assert.equal(overview?.site.visitorCount, 1);

  const left = await collectEvent(
    repo,
    {
      op: "pageleave",
      siteKey,
      visitorId: VISITOR,
      sessionId: SESSION,
      eventId: "event0002",
      durationMs: 15000,
      occurredAt: new Date(later.getTime() + 15000).toISOString(),
    },
    { now: new Date(later.getTime() + 15000) },
  );
  assert.deepEqual(left, { ok: true });
  const afterLeave = await loadDetail(repo, siteKey, VISITOR);
  assert.equal(afterLeave?.events[1]?.durationMs, 15000);
  assert.equal(afterLeave?.visitor.activeMs, 15000);
});

test("a new visit is counted after a 30 minute gap and on the next day", async () => {
  const repo = new MemoryRepo();
  const siteKey = await site(repo);
  await collectEvent(repo, view("event0001", { siteKey }), { now: NOW });
  const gap = new Date(NOW.getTime() + 31 * 60 * 1000);
  await collectEvent(
    repo,
    view("event0003", { siteKey, path: "/again", occurredAt: gap.toISOString() }),
    { now: gap },
  );
  const sameDay = await loadDetail(repo, siteKey, VISITOR);
  assert.equal(sameDay?.visitor.visitCount, 2);

  const nextDay = new Date("2026-10-16T16:30:00.000Z");
  await collectEvent(
    repo,
    view("event0004", { siteKey, path: "/tomorrow", occurredAt: nextDay.toISOString(), sessionId: "session9999999999" }),
    { now: nextDay },
  );
  const summaries = await listSiteSummaries(repo, nextDay);
  assert.equal(summaries[0]?.todayUniques, 1);
  assert.equal(summaries[0]?.todayPageviews, 1);
  const todayOverview = await loadOverview(repo, siteKey, NOW);
  assert.equal(todayOverview?.todayPageviews, 2);
});

test("page counts merge query strings and split by day", async () => {
  assert.equal(pagePath("/shop?utm_source=bing"), "/shop");
  assert.equal(pagePath(""), "/");

  const repo = new MemoryRepo();
  const siteKey = await site(repo);
  await collectEvent(repo, view("event0001", { siteKey, path: "/shop?utm_source=bing" }), { now: NOW });
  await collectEvent(repo, view("event0002", { siteKey, path: "/shop" }), { now: NOW });
  await collectEvent(repo, view("event0003", { siteKey, path: "/shop?page=2" }), { now: NOW });
  const nextDay = new Date("2026-10-16T16:30:00.000Z");
  await collectEvent(
    repo,
    view("event0004", { siteKey, path: "/about/", occurredAt: nextDay.toISOString() }),
    { now: nextDay },
  );
  const oneDay = await loadPageReport(repo, siteKey, "2026-10-16", "2026-10-16");
  assert.deepEqual(oneDay?.pages, [{ path: "/shop", pageviews: 3 }]);
  const week = await loadPageReport(repo, siteKey, "2026-10-11", "2026-10-17");
  assert.deepEqual(week?.pages, [
    { path: "/shop", pageviews: 3 },
    { path: "/about/", pageviews: 1 },
  ]);
  assert.equal(await loadPageReport(repo, siteKey, "2026-10-01", "2026-10-17"), null);
  const detail = await loadDetail(repo, siteKey, VISITOR);
  assert.equal(detail?.events[0]?.path, "/shop?utm_source=bing");
});

test("unknown sites and bots are ignored", async () => {
  const repo = new MemoryRepo();
  const missing = await collectEvent(repo, view("event0001", { siteKey: "abcd1234" }), { now: NOW });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 404);

  const siteKey = await site(repo);
  const bot = await collectEvent(repo, view("event0001", { siteKey }), {
    now: NOW,
    userAgent: "Mozilla/5.0 Googlebot/2.1",
  });
  assert.deepEqual(bot, { ok: true });
  assert.equal(await loadDetail(repo, siteKey, VISITOR), null);
});

test("a visitor note stays after the next pageview", async () => {
  const repo = new MemoryRepo();
  const siteKey = await site(repo);
  await collectEvent(repo, view("event0001", { siteKey }), { now: NOW });
  const saved = await saveVisitorNote(repo, siteKey, VISITOR, "  Follow up about the kit  ", "valid");
  assert.equal(saved.ok, true);
  await collectEvent(repo, view("event0002", { siteKey, path: "/docs" }), { now: NOW });
  const detail = await loadDetail(repo, siteKey, VISITOR);
  assert.equal(detail?.visitor.note, "Follow up about the kit");
  assert.equal(detail?.visitor.mark, "valid");
  const cleared = await saveVisitorNote(repo, siteKey, VISITOR, "   ", "nope");
  assert.equal(cleared.ok, true);
  const after = await loadDetail(repo, siteKey, VISITOR);
  assert.equal(after?.visitor.note, "");
  assert.equal(after?.visitor.mark, "");
});

test("traffic source and device labels", () => {
  assert.equal(trafficSource(""), "direct");
  assert.equal(trafficSource("https://www.google.com/search"), "google");
  assert.equal(trafficSource("https://www.baidu.com/s"), "baidu");
  assert.equal(trafficSource("https://news.ycombinator.com/"), "news.ycombinator.com");
  assert.equal(trafficSource("not a url"), "direct");
  assert.equal(
    parseDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    "iOS · Safari",
  );
  assert.equal(
    parseDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ),
    "Windows · Edge",
  );
});

test("tracker script carries the site key and collect endpoint", () => {
  const source = trackerScript("abcd1234", "https://metrics.example/api/collect");
  assert.match(source, /abcd1234/);
  assert.match(source, /https:\/\/metrics\.example\/api\/collect/);
  assert.match(source, /pageview/);
  assert.doesNotMatch(source, /attachShadow/);
  assert.doesNotMatch(source, /<script/);
  new Function(source);
});

test("guestbook widget is appended only when the board is on", () => {
  const source = trackerScript(
    "abcd1234",
    "https://metrics.example/api/collect",
    "https://metrics.example/api/board/abcd1234",
  );
  assert.match(source, /attachShadow/);
  assert.match(source, /https:\/\/metrics\.example\/api\/board\/abcd1234/);
  assert.match(source, /Guestbook/);
  assert.match(source, /Write a message/);
  assert.doesNotMatch(source, /留言/);
  assert.doesNotMatch(source, /<script/);
  new Function(source);
});
