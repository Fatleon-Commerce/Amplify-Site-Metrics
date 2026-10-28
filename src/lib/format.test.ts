import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, formatSpan } from "./format";

test("durations under a day keep hours and minutes", () => {
  assert.equal(formatDuration(38 * 60 * 1000 + 41 * 1000), "38 minutes 41 seconds");
  assert.equal(formatDuration(2 * 60 * 60 * 1000 + 5 * 60 * 1000), "2 hours 5 minutes");
});

test("durations of a day or more are shown in days", () => {
  assert.equal(formatDuration(24 * 60 * 60 * 1000), "1 day");
  assert.equal(formatDuration(48 * 60 * 60 * 1000), "2 days");
  assert.equal(formatDuration(36 * 60 * 60 * 1000), "1.5 days");
  const span = 103 * 60 * 60 * 1000 + 26 * 60 * 1000;
  assert.equal(formatDuration(span), "4.3 days");
});

test("visitor span uses the same day conversion", () => {
  const first = "2026-10-24T01:29:00.000Z";
  const last = new Date(Date.parse(first) + 103 * 60 * 60 * 1000 + 26 * 60 * 1000).toISOString();
  assert.equal(formatSpan(first, last), "4.3 days");
});
