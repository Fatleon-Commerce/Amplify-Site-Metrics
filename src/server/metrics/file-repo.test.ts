import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { FileRepo } from "./file-repo";
import { collectEvent, createNamedSite, loadDetail } from "./service";

test("file repo keeps a pageview across instances", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "site-metrics-"));
  const filePath = path.join(directory, "metrics.json");
  try {
    const repo = new FileRepo(filePath);
    const now = new Date("2026-10-16T02:00:00.000Z");
    const created = await createNamedSite(repo, "File site", now);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await collectEvent(
      repo,
      {
        op: "pageview",
        siteKey: created.siteKey,
        visitorId: "visitor1234567890abcd",
        sessionId: "session1234567890",
        eventId: "event-file-1",
        path: "/hello",
        title: "Hello",
        occurredAt: now.toISOString(),
      },
      { now, country: "JP" },
    );

    const reloaded = new FileRepo(filePath);
    const detail = await loadDetail(reloaded, created.siteKey, "visitor1234567890abcd");
    assert.equal(detail?.events[0]?.path, "/hello");
    assert.equal(detail?.visitor.country, "JP");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
