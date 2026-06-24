import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateApiToken, hashApiToken } from "../lib/auth.ts";

// Throwaway DB before importing the data layer (see db.test.ts).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myvouch-token-test-"));
process.env.MYVOUCH_DB_PATH = path.join(tmpDir, "test.db");

const dbmod = await import("../lib/db.ts");
const {
  createUser,
  createApiToken,
  listApiTokens,
  countApiTokens,
  getUserByApiTokenHash,
  revokeApiToken,
  deleteUser,
} = dbmod;

/* ---------- pure auth primitives ---------- */

test("generateApiToken is prefixed and unique", () => {
  const a = generateApiToken();
  const b = generateApiToken();
  assert.ok(a.startsWith("mv_"));
  assert.notEqual(a, b);
});

test("hashApiToken is deterministic and discriminating", () => {
  const raw = generateApiToken();
  assert.equal(hashApiToken(raw), hashApiToken(raw));
  assert.notEqual(hashApiToken(raw), hashApiToken(generateApiToken()));
  // SHA-256 hex.
  assert.match(hashApiToken(raw), /^[0-9a-f]{64}$/);
});

/* ---------- data layer ---------- */

let owner: number;
let other: number;

before(() => {
  owner = createUser({
    name: "Owner",
    email: "owner@corp.com",
    password_hash: "x:y",
    slug: "owner",
  });
  other = createUser({
    name: "Other",
    email: "other@corp.com",
    password_hash: "x:y",
    slug: "other",
  });
});

test("token round-trips: create → authenticate → list", () => {
  const raw = generateApiToken();
  const id = createApiToken(owner, "script", hashApiToken(raw));
  assert.ok(id > 0);

  const user = getUserByApiTokenHash(hashApiToken(raw));
  assert.equal(user?.id, owner);

  const list = listApiTokens(owner);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "script");
  // Metadata only — the secret digest is never exposed.
  assert.ok(!("token_hash" in list[0]));
});

test("authenticating stamps last_used_at", () => {
  const raw = generateApiToken();
  createApiToken(owner, "used", hashApiToken(raw));
  assert.equal(listApiTokens(owner)[0].last_used_at, null);
  getUserByApiTokenHash(hashApiToken(raw));
  assert.notEqual(listApiTokens(owner)[0].last_used_at, null);
});

test("unknown token resolves to undefined", () => {
  assert.equal(getUserByApiTokenHash(hashApiToken("mv_nope")), undefined);
});

test("revoke is owner-scoped and disables the token", () => {
  const raw = generateApiToken();
  const id = createApiToken(owner, "revoke-me", hashApiToken(raw));

  // Another user can't revoke it.
  assert.equal(revokeApiToken(id, other), false);
  assert.equal(getUserByApiTokenHash(hashApiToken(raw))?.id, owner);

  // Owner can; afterwards it no longer authenticates.
  assert.equal(revokeApiToken(id, owner), true);
  assert.equal(getUserByApiTokenHash(hashApiToken(raw)), undefined);
  assert.equal(revokeApiToken(id, owner), false); // idempotent
});

test("countApiTokens reflects live rows", () => {
  const before = countApiTokens(other);
  const raw = generateApiToken();
  const id = createApiToken(other, "count", hashApiToken(raw));
  assert.equal(countApiTokens(other), before + 1);
  revokeApiToken(id, other);
  assert.equal(countApiTokens(other), before);
});

test("deleting a user cascades away their tokens", () => {
  const victim = createUser({
    name: "Victim",
    email: "victim@corp.com",
    password_hash: "x:y",
    slug: "victim",
  });
  const raw = generateApiToken();
  createApiToken(victim, "doomed", hashApiToken(raw));
  assert.equal(countApiTokens(victim), 1);
  deleteUser(victim);
  assert.equal(getUserByApiTokenHash(hashApiToken(raw)), undefined);
  assert.equal(countApiTokens(victim), 0);
});
