import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, rateLimitAll } from "../lib/ratelimit.ts";

test("rateLimit allows up to the limit then trips", () => {
  const key = `t:${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    assert.equal(rateLimit(key, 3, 60_000).ok, true);
  }
  const tripped = rateLimit(key, 3, 60_000);
  assert.equal(tripped.ok, false);
  assert.ok(tripped.retryAfter > 0);
});

test("rateLimit window resets after expiry", async () => {
  const key = `t:${Math.random()}`;
  assert.equal(rateLimit(key, 1, 20).ok, true);
  assert.equal(rateLimit(key, 1, 20).ok, false);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(rateLimit(key, 1, 20).ok, true);
});

test("rateLimitAll isolates buckets by key (no cross-account lockout)", () => {
  const a = `email:${Math.random()}`;
  const b = `email:${Math.random()}`;
  const ip = `ip:shared`;
  // Exhaust account A's identity bucket.
  for (let i = 0; i < 5; i++) {
    rateLimitAll([
      { key: a, limit: 5, windowMs: 60_000 },
      { key: ip, limit: 9999, windowMs: 60_000 },
    ]);
  }
  const aTripped = rateLimitAll([
    { key: a, limit: 5, windowMs: 60_000 },
    { key: ip, limit: 9999, windowMs: 60_000 },
  ]);
  assert.equal(aTripped.ok, false, "account A should be limited");

  // Account B, sharing the same IP bucket, is still allowed.
  const bOk = rateLimitAll([
    { key: b, limit: 5, windowMs: 60_000 },
    { key: ip, limit: 9999, windowMs: 60_000 },
  ]);
  assert.equal(bOk.ok, true, "account B must not be locked out by A");
});

test("rateLimitAll trips if any single rule trips", () => {
  const ok = `ok:${Math.random()}`;
  const tight = `tight:${Math.random()}`;
  rateLimitAll([{ key: tight, limit: 1, windowMs: 60_000 }]);
  const r = rateLimitAll([
    { key: ok, limit: 100, windowMs: 60_000 },
    { key: tight, limit: 1, windowMs: 60_000 },
  ]);
  assert.equal(r.ok, false);
});
