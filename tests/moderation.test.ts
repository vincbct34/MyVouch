import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point the data layer at a throwaway database BEFORE importing it. Using a
// dynamic import guarantees the env var is set before db.ts first connects.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myvouch-test-"));
process.env.MYVOUCH_DB_PATH = path.join(tmpDir, "test.db");

const dbmod = await import("../lib/db.ts");
const {
  createUser,
  createEndorsement,
  moderateEndorsement,
  setLinkedInMatched,
  confirmEndorsementEmail,
  getApprovedEndorsements,
  updatePassword,
  bumpSessionEpoch,
  getUserById,
} = dbmod;

let ownerA: number;
let ownerB: number;

before(() => {
  ownerA = createUser({
    name: "Owner A",
    email: "a@example.com",
    password_hash: "x:y",
    slug: "owner-a",
  });
  ownerB = createUser({
    name: "Owner B",
    email: "b@example.com",
    password_hash: "x:y",
    slug: "owner-b",
  });
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function newEndorsement(userId: number, email = `r${Math.random()}@corp.com`) {
  return createEndorsement({
    user_id: userId,
    reviewer_name: "Reviewer",
    reviewer_email: email,
    relationship: "peer",
    rating: 5,
    body: "A thoughtful and sufficiently long endorsement body.",
  });
}

test("moderateEndorsement is owner-scoped (no IDOR)", () => {
  const id = newEndorsement(ownerA);
  // Owner B must not be able to moderate Owner A's endorsement.
  assert.equal(moderateEndorsement(id, ownerB, "approved"), false);
  // Owner A can.
  assert.equal(moderateEndorsement(id, ownerA, "approved"), true);
  assert.equal(getApprovedEndorsements(ownerA).length, 1);
  assert.equal(getApprovedEndorsements(ownerB).length, 0);
});

test("setLinkedInMatched is owner-scoped", () => {
  const id = newEndorsement(ownerA);
  assert.equal(setLinkedInMatched(id, ownerB, true), false);
  assert.equal(setLinkedInMatched(id, ownerA, true), true);
});

test("duplicate pending submission from same reviewer email is blocked (#8)", () => {
  const email = "dupe@corp.com";
  newEndorsement(ownerA, email);
  assert.throws(() => newEndorsement(ownerA, email), /UNIQUE|constraint/i);
});

test("bumpSessionEpoch increments and persists (session revocation)", () => {
  const before = getUserById(ownerA)!.session_epoch;
  const returned = bumpSessionEpoch(ownerA);
  assert.equal(returned, before + 1);
  assert.equal(getUserById(ownerA)!.session_epoch, before + 1);
});

test("updatePassword replaces the stored hash", () => {
  const ok = updatePassword(ownerA, "newsalt:newhash");
  assert.equal(ok, true);
  assert.equal(getUserById(ownerA)!.password_hash, "newsalt:newhash");
});

test("confirmEndorsementEmail flips the flag and clears the token", () => {
  const id = createEndorsement({
    user_id: ownerB,
    reviewer_name: "Reviewer",
    reviewer_email: "confirm@corp.com",
    relationship: "peer",
    rating: 4,
    body: "Another sufficiently long endorsement body for confirmation.",
    confirm_token: "tok-123",
  });
  assert.ok(id > 0);
  const res = confirmEndorsementEmail("tok-123");
  assert.equal(res.result, "ok");
  assert.equal(res.slug, "owner-b");
  // Token is single-use — second attempt is invalid.
  assert.equal(confirmEndorsementEmail("tok-123").result, "invalid");
});
