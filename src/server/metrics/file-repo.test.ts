import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadBoardMessages, postBoard, setGuestbookEnabled } from "./board";
import { FileRepo } from "./file-repo";
import { collectEvent, createNamedSite, loadDetail, loadPageDetail, removeSite } from "./service";
import { signBoardStamp } from "./token";

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
    const page = await loadPageDetail(reloaded, created.siteKey, "/hello", "2026-10-16", "2026-10-16");
    assert.equal(page?.visitors, 1);
    assert.equal(page?.sources[0]?.key, "direct");
    assert.equal(page?.countries[0]?.key, "JP");
    assert.equal(page?.devices[0]?.key, "unknown");

    await setGuestbookEnabled(repo, created.siteKey, true);
    const stamp = signBoardStamp("secret-pass", created.siteKey, now.getTime() - 5000);
    const posted = await postBoard(
      repo,
      created.siteKey,
      { body: "hello file", email: "ada@example.com", stamp },
      { now, ip: "203.0.113.9" },
      "secret-pass",
    );
    assert.equal(posted.ok, true);

    const reloadedBoard = new FileRepo(filePath);
    const messages = await loadBoardMessages(reloadedBoard, created.siteKey);
    assert.equal(messages?.[0]?.body, "hello file");
    assert.equal(messages?.[0]?.email, "ada@example.com");
    assert.equal((await reloadedBoard.getSite(created.siteKey))?.guestbookEnabled, true);
    await removeSite(reloadedBoard, created.siteKey);
    assert.equal(await new FileRepo(filePath).getSite(created.siteKey), null);
    assert.deepEqual(await new FileRepo(filePath).listMessages(created.siteKey, 10), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
