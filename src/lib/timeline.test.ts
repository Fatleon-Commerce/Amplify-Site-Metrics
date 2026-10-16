import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline } from "./timeline";
import type { EventRecord } from "../server/metrics/types";

function event(partial: Partial<EventRecord> & Pick<EventRecord, "occurredAt" | "path">): EventRecord {
  return {
    siteKey: "abcd1234",
    visitorId: "visitor12345678",
    eventId: partial.eventId ?? partial.path,
    sessionId: "session123456",
    title: partial.path,
    durationMs: -1,
    ttl: 0,
    ...partial,
  };
}

test("timeline inserts a gap and estimates stay from the next page", () => {
  const rows = buildTimeline(
    [
      event({ occurredAt: "2026-10-16T02:00:00.000Z", path: "/a", eventId: "a" }),
      event({ occurredAt: "2026-10-16T02:02:00.000Z", path: "/b", eventId: "b" }),
      event({ occurredAt: "2026-10-16T04:00:00.000Z", path: "/c", eventId: "c" }),
    ],
    Date.parse("2026-10-16T05:00:00.000Z"),
  );

  assert.equal(rows[0]?.kind, "page");
  assert.equal(rows[0]?.kind === "page" ? rows[0].durationLabel : "", "Stayed 2 minutes");
  assert.equal(rows[1]?.kind, "page");
  assert.equal(rows[2]?.kind, "gap");
  assert.equal(rows[3]?.kind, "page");
  assert.equal(rows[3]?.kind === "page" ? rows[3].durationLabel : "", "—");
});

test("the newest page is marked current while the visit is fresh", () => {
  const now = Date.parse("2026-10-16T02:00:30.000Z");
  const rows = buildTimeline(
    [event({ occurredAt: "2026-10-16T02:00:00.000Z", path: "/", eventId: "home" })],
    now,
  );
  assert.equal(rows[0]?.kind === "page" ? rows[0].current : false, true);
  assert.equal(rows[0]?.kind === "page" ? rows[0].durationLabel : "", "Current page");
});
