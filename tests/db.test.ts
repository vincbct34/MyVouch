import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Throwaway DB before importing the data layer (see moderation.test.ts).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vouch-db-test-"));
process.env.VOUCH_DB_PATH = path.join(tmpDir, "test.db");

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
  getUserById,
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
  assert.equal(getApprovedEndorsements(p, { limit: 20, offset: 0 }).length, 20);
  assert.equal(getApprovedEndorsements(p, { limit: 20, offset: 20 }).length, 5);

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
