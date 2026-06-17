import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
  dummyVerify,
  createSessionToken,
  verifySessionToken,
} from "../lib/auth.ts";

test("hashPassword / verifyPassword round-trips", () => {
  const stored = hashPassword("correct horse battery staple");
  assert.equal(verifyPassword("correct horse battery staple", stored), true);
  assert.equal(verifyPassword("wrong password", stored), false);
});

test("hashPassword salts: same password hashes differently", () => {
  assert.notEqual(hashPassword("same"), hashPassword("same"));
});

test("verifyPassword rejects malformed stored value", () => {
  assert.equal(verifyPassword("x", "no-colon"), false);
  assert.equal(verifyPassword("x", ""), false);
});

test("dummyVerify always returns false (timing path)", () => {
  assert.equal(dummyVerify("anything"), false);
});

test("session token round-trips with matching epoch", () => {
  const token = createSessionToken(42, 3);
  const claims = verifySessionToken(token);
  assert.deepEqual(claims, { userId: 42, epoch: 3 });
});

test("tampered session token is rejected", () => {
  const token = createSessionToken(42, 0);
  const parts = token.split(".");
  parts[0] = "99"; // change the user id, signature no longer matches
  assert.equal(verifySessionToken(parts.join(".")), null);
});

test("malformed token shape is rejected", () => {
  assert.equal(verifySessionToken("a.b.c"), null);
  assert.equal(verifySessionToken("garbage"), null);
});

test("epoch is carried in claims for revocation checks", () => {
  // A token minted at epoch 0 still verifies structurally; the caller compares
  // claims.epoch against the user's current epoch to reject revoked sessions.
  const claims = verifySessionToken(createSessionToken(7, 0));
  assert.equal(claims?.epoch, 0);
});
