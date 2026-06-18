import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Throwaway DB before importing the data layer (see moderation.test.ts).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myvouch-db-test-"));
process.env.MYVOUCH_DB_PATH = path.join(tmpDir, "test.db");

const dbmod = await import("../lib/db.ts");
const {
  db,
  createUser,
  createEndorsement,
  moderateEndorsement,
  getApprovedEndorsements,
  countApprovedEndorsements,
  getApprovedStats,
  getEndorsementsForOwner,
  deleteEndorsement,
  updateEndorsementBody,
  confirmEndorsementEmail,
  rotateEndorsementConfirmToken,
  setEmailConfirmToken,
  confirmUserEmail,
  canResendUserConfirm,
  appendAuditLog,
  getAuditLog,
  getUserById,
  getUserBySlug,
  updateName,
  updateEmail,
  setAvatar,
  clearAvatar,
  getAvatarBytesBySlug,
  deleteUser,
  encodeCursor,
  decodeCursor,
  getEndorsementByManageToken,
  withdrawEndorsementByManageToken,
  enqueueOutbox,
  pendingOutbox,
  markOutboxSent,
  markOutboxFailed,
} = dbmod;

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

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Age a column on a row so TTL/cooldown logic sees it as old. */
function ageBy(table: string, id: number, column: string, ms: number) {
  const iso = new Date(Date.now() - ms)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  db().prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(iso, id);
}

test("owner email confirm: token confirms, expires, and resend cooldown", () => {
  setEmailConfirmToken(owner, "owner-tok");
  // Cooldown not yet elapsed (just sent).
  assert.equal(canResendUserConfirm(owner), false);
  assert.equal(confirmUserEmail("owner-tok"), "ok");
  assert.equal(getUserById(owner)!.email_confirmed, 1);
  // Token cleared → invalid second time.
  assert.equal(confirmUserEmail("owner-tok"), "invalid");

  // Expired link path.
  setEmailConfirmToken(other, "other-tok");
  ageBy("users", other, "email_confirm_sent_at", 8 * 24 * 60 * 60 * 1000);
  assert.equal(confirmUserEmail("other-tok"), "expired");
  // Cooldown elapsed now that it's old.
  assert.equal(canResendUserConfirm(other), true);
});

test("reviewer confirm token TTL: fresh confirms, aged is expired", () => {
  const fresh = createEndorsement({
    user_id: owner,
    reviewer_name: "R",
    reviewer_email: "fresh@corp.com",
    relationship: "peer",
    rating: 5,
    body: "A sufficiently long endorsement body for confirmation.",
    confirm_token: "fresh-tok",
  });
  assert.equal(confirmEndorsementEmail("fresh-tok").result, "ok");

  const stale = createEndorsement({
    user_id: owner,
    reviewer_name: "R",
    reviewer_email: "stale@corp.com",
    relationship: "peer",
    rating: 5,
    body: "Another sufficiently long endorsement body here.",
    confirm_token: "stale-tok",
  });
  ageBy("endorsements", stale, "confirm_sent_at", 8 * 24 * 60 * 60 * 1000);
  const res = confirmEndorsementEmail("stale-tok");
  assert.equal(res.result, "expired");
  assert.equal(res.slug, "owner");
  assert.ok(fresh > 0);
});

test("rotateEndorsementConfirmToken respects cooldown and pending state", () => {
  const id = createEndorsement({
    user_id: owner,
    reviewer_name: "R",
    reviewer_email: "rotate@corp.com",
    relationship: "peer",
    rating: 5,
    body: "Yet another sufficiently long endorsement body string.",
    confirm_token: "rot-1",
  });
  // Just sent → cooldown blocks a resend.
  assert.equal(
    rotateEndorsementConfirmToken(owner, "rotate@corp.com", "rot-2"),
    null,
  );
  // After cooldown, a fresh token is minted.
  ageBy("endorsements", id, "confirm_sent_at", 6 * 60 * 1000);
  assert.equal(
    rotateEndorsementConfirmToken(owner, "rotate@corp.com", "rot-2"),
    "rot-2",
  );
  // Confirming clears pending eligibility → no further rotation.
  confirmEndorsementEmail("rot-2");
  ageBy("endorsements", id, "confirm_sent_at", 6 * 60 * 1000);
  assert.equal(
    rotateEndorsementConfirmToken(owner, "rotate@corp.com", "rot-3"),
    null,
  );
});

test("pagination: limit/offset slices and counts/stats aggregate over all", () => {
  const p = createUser({
    name: "Paginate",
    email: "pag@corp.com",
    password_hash: "x:y",
    slug: "pag",
  });
  for (let i = 0; i < 25; i++) {
    const id = createEndorsement({
      user_id: p,
      reviewer_name: `Rev ${i}`,
      reviewer_email: `rev${i}@corp.com`,
      relationship: "peer",
      rating: i % 5 === 0 ? 3 : 5,
      body: "A sufficiently long endorsement body for pagination tests.",
    });
    moderateEndorsement(id, p, "approved");
  }
  assert.equal(countApprovedEndorsements(p), 25);

  // Keyset pagination: first page, then cursor onto the next.
  const page1 = getApprovedEndorsements(p, { limit: 20 });
  assert.equal(page1.length, 20);
  const cursor = decodeCursor(encodeCursor(page1[page1.length - 1]));
  const page2 = getApprovedEndorsements(p, { limit: 20, cursor });
  assert.equal(page2.length, 5);
  // Pages are disjoint and ordered (no overlap across the cursor boundary).
  const ids1 = new Set(page1.map((e) => e.id));
  assert.ok(page2.every((e) => !ids1.has(e.id)));
  // A malformed cursor decodes to null (falls back to the first page).
  assert.equal(decodeCursor("not-a-cursor"), null);

  const stats = getApprovedStats(p);
  assert.equal(stats.total, 25);
  assert.ok(stats.avgRating !== null && stats.avgRating > 4);
  // 5 of 25 rated 3 (i % 5 === 0), so 20 rated >=4 → 80%.
  assert.equal(stats.recommendPct, 80);
});

test("delete/edit are owner-scoped (no IDOR)", () => {
  const id = createEndorsement({
    user_id: owner,
    reviewer_name: "R",
    reviewer_email: "scoped@corp.com",
    relationship: "peer",
    rating: 5,
    body: "Original sufficiently long endorsement body content here.",
  });
  // Other owner cannot edit or delete.
  assert.equal(updateEndorsementBody(id, other, "x".repeat(30)), false);
  assert.equal(deleteEndorsement(id, other), false);
  // Owner can edit, then delete.
  assert.equal(
    updateEndorsementBody(id, owner, "An edited sufficiently long body."),
    true,
  );
  assert.equal(deleteEndorsement(id, owner), true);
  assert.equal(deleteEndorsement(id, owner), false); // already gone
});

test("appendAuditLog writes a row", () => {
  appendAuditLog(owner, "test.action", "detail=1");
  const row = db()
    .prepare(
      `SELECT action, detail FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(owner) as { action: string; detail: string };
  assert.equal(row.action, "test.action");
  assert.equal(row.detail, "detail=1");
});

test("getEndorsementsForOwner returns all statuses, capped by limit", () => {
  const cnt = getEndorsementsForOwner(owner, { limit: 500 }).length;
  assert.ok(cnt >= 1);
});

test("manage_token: reviewer can look up and withdraw their own endorsement", () => {
  const id = createEndorsement({
    user_id: owner,
    reviewer_name: "Withdrawer",
    reviewer_email: "withdraw@corp.com",
    relationship: "peer",
    rating: 5,
    body: "An endorsement the reviewer will later withdraw entirely.",
    manage_token: "mtok-123",
  });
  assert.ok(id > 0);
  const view = getEndorsementByManageToken("mtok-123");
  assert.equal(view?.reviewer_name, "Withdrawer");
  assert.equal(view?.owner_slug, "owner");
  // Withdrawal deletes the row; idempotent on a second call.
  assert.equal(withdrawEndorsementByManageToken("mtok-123"), true);
  assert.equal(withdrawEndorsementByManageToken("mtok-123"), false);
  assert.equal(getEndorsementByManageToken("mtok-123"), undefined);
  // Unknown token is a no-op, not an error.
  assert.equal(withdrawEndorsementByManageToken("nope"), false);
});

test("getAuditLog returns owner's entries most-recent-first", () => {
  appendAuditLog(other, "password.change", null);
  appendAuditLog(other, "session.logout_all", null);
  const log = getAuditLog(other, 10);
  assert.ok(log.length >= 2);
  assert.equal(log[0].action, "session.logout_all"); // newest first
});

test("outbox: enqueue, mark sent/failed, and the pending sweep predicate", () => {
  const a = enqueueOutbox({
    recipient: "a@corp.com",
    subject: "S",
    html: "<p>h</p>",
    text: "t",
  });
  const b = enqueueOutbox({
    recipient: "b@corp.com",
    subject: "S",
    html: "<p>h</p>",
    text: "t",
  });
  const idsBefore = pendingOutbox(6, 50).map((r) => r.id);
  assert.ok(idsBefore.includes(a) && idsBefore.includes(b));

  // Sent rows drop out of the pending set.
  markOutboxSent(a);
  assert.ok(!pendingOutbox(6, 50).some((r) => r.id === a));

  // Failed rows stay pending until they exceed the attempt cap.
  markOutboxFailed(b, "smtp down");
  assert.ok(pendingOutbox(6, 50).some((r) => r.id === b));
  assert.ok(!pendingOutbox(1, 50).some((r) => r.id === b)); // attempts(1) >= cap(1)
});

test("updateName changes name but leaves the slug (shared links) intact", () => {
  const id = createUser({
    name: "Renamer",
    email: "rename@corp.com",
    password_hash: "x:y",
    slug: "renamer",
  });
  assert.equal(updateName(id, "Renamed Person"), true);
  const u = getUserById(id)!;
  assert.equal(u.name, "Renamed Person");
  assert.equal(u.slug, "renamer"); // unchanged
});

test("updateEmail swaps the address and resets the confirmation state", () => {
  const id = createUser({
    name: "Emailer",
    email: "before@corp.com",
    password_hash: "x:y",
    slug: "emailer",
  });
  // Mark confirmed, then change the email — confirmation must reset.
  setEmailConfirmToken(id, "etok");
  confirmUserEmail("etok");
  assert.equal(getUserById(id)!.email_confirmed, 1);

  assert.equal(updateEmail(id, "after@corp.com"), true);
  const u = getUserById(id)!;
  assert.equal(u.email, "after@corp.com");
  assert.equal(u.email_confirmed, 0);
  assert.equal(u.email_confirm_token, null);
});

test("avatar: set, read by slug, clear, and updated_at flag", () => {
  const id = createUser({
    name: "Pho To",
    email: "photo@corp.com",
    password_hash: "x:y",
    slug: "photo",
  });
  assert.equal(getUserById(id)!.avatar_updated_at, null);
  assert.equal(getAvatarBytesBySlug("photo"), undefined);

  setAvatar(id, Buffer.from([1, 2, 3, 4]), "image/jpeg");
  const got = getAvatarBytesBySlug("photo")!;
  assert.equal(got.mime, "image/jpeg");
  assert.ok(Buffer.from(got.bytes).equals(Buffer.from([1, 2, 3, 4])));
  assert.ok(getUserById(id)!.avatar_updated_at !== null);

  // Replace then clear.
  setAvatar(id, Buffer.from([9]), "image/png");
  assert.equal(getAvatarBytesBySlug("photo")!.mime, "image/png");
  clearAvatar(id);
  assert.equal(getAvatarBytesBySlug("photo"), undefined);
  assert.equal(getUserById(id)!.avatar_updated_at, null);
});

test("deleteUser removes the account and cascades endorsements + avatar", () => {
  const id = createUser({
    name: "Goodbye",
    email: "bye@corp.com",
    password_hash: "x:y",
    slug: "goodbye",
  });
  createEndorsement({
    user_id: id,
    reviewer_name: "R",
    reviewer_email: "bye-rev@corp.com",
    relationship: "peer",
    rating: 5,
    body: "An endorsement removed when the account is deleted entirely.",
  });
  setAvatar(id, Buffer.from([7]), "image/jpeg");

  assert.equal(deleteUser(id), true);
  assert.equal(getUserBySlug("goodbye"), undefined);
  assert.equal(getAvatarBytesBySlug("goodbye"), undefined);
  const left = db()
    .prepare(`SELECT COUNT(*) AS c FROM endorsements WHERE user_id = ?`)
    .get(id) as { c: number };
  assert.equal(left.c, 0);
  // Idempotent: deleting an absent user is a no-op, not an error.
  assert.equal(deleteUser(id), false);
});

test("foreign_keys ON: deleting a user cascades to their endorsements", () => {
  const tmp = createUser({
    name: "Doomed",
    email: "doomed@corp.com",
    password_hash: "x:y",
    slug: "doomed",
  });
  createEndorsement({
    user_id: tmp,
    reviewer_name: "R",
    reviewer_email: "casc@corp.com",
    relationship: "peer",
    rating: 5,
    body: "This endorsement should be cascade-deleted with its owner.",
  });
  appendAuditLog(tmp, "test.action", null);
  db().prepare(`DELETE FROM users WHERE id = ?`).run(tmp);
  const left = db()
    .prepare(`SELECT COUNT(*) AS c FROM endorsements WHERE user_id = ?`)
    .get(tmp) as { c: number };
  const audit = db()
    .prepare(`SELECT COUNT(*) AS c FROM audit_log WHERE user_id = ?`)
    .get(tmp) as { c: number };
  assert.equal(left.c, 0);
  assert.equal(audit.c, 0);
});
