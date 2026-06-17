import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin, isLikelyBot, MIN_SUBMIT_MS } from "../lib/http.ts";

/** Build a Request-shaped stub with controllable headers (undici strips `host`). */
function req(headers: Record<string, string>): Request {
  const h = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
  } as unknown as Request;
}

test("isSameOrigin: accepts a matching Origin host", () => {
  assert.equal(
    isSameOrigin(req({ host: "myvouch.fr", origin: "https://myvouch.fr" })),
    true,
  );
});

test("isSameOrigin: falls back to Referer when Origin is absent", () => {
  assert.equal(
    isSameOrigin(
      req({ host: "myvouch.fr", referer: "https://myvouch.fr/u/x/vouch" }),
    ),
    true,
  );
});

test("isSameOrigin: rejects a cross-origin request", () => {
  assert.equal(
    isSameOrigin(req({ host: "myvouch.fr", origin: "https://evil.example" })),
    false,
  );
});

test("isSameOrigin: rejects when host or origin/referer is missing", () => {
  assert.equal(isSameOrigin(req({ origin: "https://myvouch.fr" })), false);
  assert.equal(isSameOrigin(req({ host: "myvouch.fr" })), false);
});

test("isSameOrigin: rejects a malformed Origin", () => {
  assert.equal(
    isSameOrigin(req({ host: "myvouch.fr", origin: "::::" })),
    false,
  );
});

test("isLikelyBot: flags a filled honeypot", () => {
  assert.equal(isLikelyBot({ honeypot: "http://spam", elapsedMs: 9000 }), true);
  assert.equal(isLikelyBot({ honeypot: "   ", elapsedMs: 9000 }), false);
});

test("isLikelyBot: flags an implausibly fast submit", () => {
  assert.equal(isLikelyBot({ elapsedMs: MIN_SUBMIT_MS - 1 }), true);
  assert.equal(isLikelyBot({ elapsedMs: MIN_SUBMIT_MS + 1 }), false);
});

test("isLikelyBot: a normal human submission passes", () => {
  assert.equal(isLikelyBot({ honeypot: "", elapsedMs: 12000 }), false);
  // Missing timing alone is not enough to flag (NaN → not finite).
  assert.equal(isLikelyBot({}), false);
});
