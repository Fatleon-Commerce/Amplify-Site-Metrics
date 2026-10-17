import assert from "node:assert/strict";
import test from "node:test";
import { deleteBoardMessage, loadBoardMessages, openBoard, postBoard, setGuestbookEnabled } from "./board";
import { collectEvent, createNamedSite, removeSite } from "./service";
import { MemoryRepo } from "./memory-repo";
import { signBoardStamp } from "./token";

const SECRET = "secret-pass";
const NOW = new Date("2026-10-16T02:00:00.000Z");

async function site(): Promise<{ repo: MemoryRepo; siteKey: string }> {
  const repo = new MemoryRepo();
  const created = await createNamedSite(repo, "Board", NOW);
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("site");
  return { repo, siteKey: created.siteKey };
}

function send(
  repo: MemoryRepo,
  siteKey: string,
  now: Date,
  body: string,
  extra: Record<string, unknown> = {},
  ip = "203.0.113.8",
) {
  const stamp = signBoardStamp(SECRET, siteKey, now.getTime() - 5000);
  return postBoard(
    repo,
    siteKey,
    { body, stamp, ...extra },
    { now, ip, userAgent: "Mozilla/5.0" },
    SECRET,
  );
}

test("guestbook stays off until it is turned on", async () => {
  const { repo, siteKey } = await site();
  assert.equal((await repo.getSite(siteKey))?.guestbookEnabled, false);
  const closed = await openBoard(repo, siteKey, SECRET, NOW);
  assert.deepEqual(closed, { ok: true, enabled: false });
  const denied = await send(repo, siteKey, NOW, "hello");
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error, "closed");

  assert.equal((await setGuestbookEnabled(repo, siteKey, true)).ok, true);
  const opened = await openBoard(repo, siteKey, SECRET, NOW);
  assert.equal(opened.ok, true);
  if (!opened.ok || !opened.enabled) return;
  assert.equal(opened.messages.length, 0);
  assert.equal(typeof opened.stamp, "string");
});

test("a message is stored as text and can be deleted", async () => {
  const { repo, siteKey } = await site();
  await setGuestbookEnabled(repo, siteKey, true);
  const saved = await send(repo, siteKey, NOW, "  <b>hello</b>\nthere  ", { name: "  Ada  " });
  assert.equal(saved.ok, true);
  if (!saved.ok || !saved.message) return;
  assert.equal(saved.message.body, "<b>hello</b>\nthere");
  assert.equal(saved.message.name, "Ada");
  assert.equal("ip" in saved.message, false);

  const listed = await openBoard(repo, siteKey, SECRET, NOW);
  assert.equal(listed.ok && listed.enabled && listed.messages[0]?.body, "<b>hello</b>\nthere");
  const admin = await loadBoardMessages(repo, siteKey);
  assert.equal(admin?.[0]?.ip, "203.0.113.8");

  const removed = await deleteBoardMessage(repo, siteKey, saved.message.messageId);
  assert.equal(removed.ok, true);
  assert.deepEqual(await loadBoardMessages(repo, siteKey), []);
});

test("guestbook rejects fast, repeated, and automated posts", async () => {
  const { repo, siteKey } = await site();
  await setGuestbookEnabled(repo, siteKey, true);

  const fresh = signBoardStamp(SECRET, siteKey, NOW.getTime() - 1000);
  const tooFast = await postBoard(repo, siteKey, { body: "hi", stamp: fresh }, { now: NOW, ip: "203.0.113.8" }, SECRET);
  assert.equal(tooFast.ok, false);
  if (!tooFast.ok) assert.equal(tooFast.error, "wait");

  const expired = signBoardStamp(SECRET, siteKey, NOW.getTime() - 31 * 60 * 1000);
  const stale = await postBoard(repo, siteKey, { body: "hi", stamp: expired }, { now: NOW, ip: "203.0.113.8" }, SECRET);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error, "stamp");

  const other = signBoardStamp(SECRET, "zzzzzzzz", NOW.getTime() - 5000);
  const wrongSite = await postBoard(repo, siteKey, { body: "hi", stamp: other }, { now: NOW, ip: "203.0.113.8" }, SECRET);
  assert.equal(wrongSite.ok, false);
  if (!wrongSite.ok) assert.equal(wrongSite.error, "stamp");

  const honey = await send(repo, siteKey, NOW, "buy now", { company: "spam" });
  assert.deepEqual(honey, { ok: true });
  assert.deepEqual(await loadBoardMessages(repo, siteKey), []);

  const bot = await postBoard(
    repo,
    siteKey,
    { body: "hi", stamp: signBoardStamp(SECRET, siteKey, NOW.getTime() - 5000) },
    { now: NOW, ip: "203.0.113.8", userAgent: "Mozilla/5.0 Googlebot/2.1" },
    SECRET,
  );
  assert.deepEqual(bot, { ok: true });
  assert.deepEqual(await loadBoardMessages(repo, siteKey), []);

  const empty = await send(repo, siteKey, NOW, "   ");
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.error, "empty");

  const large = await send(repo, siteKey, NOW, "a".repeat(1001));
  assert.equal(large.ok, false);
  if (!large.ok) assert.equal(large.error, "large");

  const first = await send(repo, siteKey, NOW, "hello");
  assert.equal(first.ok, true);
  const soon = await send(repo, siteKey, new Date(NOW.getTime() + 5000), "again");
  assert.equal(soon.ok, false);
  if (!soon.ok) assert.equal(soon.error, "wait");

  const duplicate = await send(repo, siteKey, new Date(NOW.getTime() + 21_000), "hello");
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error, "duplicate");

  for (let index = 1; index < 5; index += 1) {
    const posted = await send(repo, siteKey, new Date(NOW.getTime() + index * 21_000), `note ${index}`);
    assert.equal(posted.ok, true, `post ${index}`);
  }
  const blocked = await send(repo, siteKey, new Date(NOW.getTime() + 5 * 21_000), "note 5");
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error, "rate");
});

test("turning the guestbook on survives the next pageview, and deleting the site removes messages", async () => {
  const { repo, siteKey } = await site();
  await setGuestbookEnabled(repo, siteKey, true);
  await send(repo, siteKey, NOW, "keep me");
  await collectEvent(
    repo,
    {
      op: "pageview",
      siteKey,
      visitorId: "visitor1234567890abcd",
      sessionId: "session1234567890",
      eventId: "event0001",
      path: "/",
      occurredAt: NOW.toISOString(),
    },
    { now: NOW, userAgent: "Mozilla/5.0" },
  );
  assert.equal((await repo.getSite(siteKey))?.guestbookEnabled, true);
  assert.equal((await removeSite(repo, siteKey)).ok, true);
  assert.deepEqual(await repo.listMessages(siteKey, 10), []);
});
