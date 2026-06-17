import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite data layer for MyVouch (multi-user).
 *
 * users        — profile owners. Each owns a public endorsement wall at /u/[slug]
 *                and moderates their own incoming queue.
 * endorsements — a verified reference written by a reviewer ABOUT a user.
 *
 * The schema lives in lib/schema.sql (single source of truth, also used by the
 * seed script). migrate() reconciles older databases by adding any missing
 * columns so a long-lived myvouch.db picks up new fields without a manual reset.
 */

export type Relationship =
  | "manager"
  | "peer"
  | "report"
  | "client"
  | "partner"
  | "mentee";

export type Status = "pending" | "approved" | "declined";

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  slug: string;
  headline: string | null;
  location: string | null;
  linkedin_url: string | null;
  open_to_work: number;
  email_confirmed: number;
  email_confirm_token: string | null;
  email_confirm_sent_at: string | null;
  session_epoch: number;
  created_at: string;
}

export interface Endorsement {
  id: number;
  user_id: number;
  reviewer_name: string;
  reviewer_email: string;
  reviewer_role: string | null;
  reviewer_company: string | null;
  reviewer_linkedin: string | null;
  relationship: Relationship;
  rating: number;
  body: string;
  strengths: string | null; // JSON array
  status: Status;
  email_confirmed: number;
  employer_overlap_verified: number;
  linkedin_matched: number;
  confirm_token: string | null;
  confirm_sent_at: string | null;
  manage_token: string | null;
  submitted_at: string;
  resolved_at: string | null;
}

/**
 * Public-safe view of an endorsement. NEVER expose reviewer_email,
 * confirm_token, or confirm_sent_at to the client — the public wall and its
 * load-more endpoint serialize only these fields.
 */
export interface PublicEndorsement {
  id: number;
  reviewer_name: string;
  reviewer_role: string | null;
  reviewer_company: string | null;
  relationship: Relationship;
  rating: number;
  body: string;
  strengths: string | null;
  email_confirmed: number;
  employer_overlap_verified: number;
  linkedin_matched: number;
  resolved_at: string | null;
  submitted_at: string;
}

export function toPublicEndorsement(e: Endorsement): PublicEndorsement {
  return {
    id: e.id,
    reviewer_name: e.reviewer_name,
    reviewer_role: e.reviewer_role,
    reviewer_company: e.reviewer_company,
    relationship: e.relationship,
    rating: e.rating,
    body: e.body,
    strengths: e.strengths,
    email_confirmed: e.email_confirmed,
    employer_overlap_verified: e.employer_overlap_verified,
    linkedin_matched: e.linkedin_matched,
    resolved_at: e.resolved_at,
    submitted_at: e.submitted_at,
  };
}

const globalForDb = globalThis as unknown as {
  __myvouchDb?: Database.Database;
};

const SCHEMA_PATH = path.join(process.cwd(), "lib", "schema.sql");

/**
 * How long a one-time confirmation link stays valid (owner email + reviewer
 * endorsement). After this, the link is rejected and the user is offered a
 * resend. RESEND_COOLDOWN_MS rate-limits how often a fresh link can be minted.
 */
export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
/** Default page size for the public wall / owner queue. */
export const PAGE_SIZE = 20;

/** Columns we expect on each table, used to ALTER older databases into shape. */
const EXPECTED_COLUMNS: Record<string, Record<string, string>> = {
  users: {
    linkedin_url: "TEXT",
    email_confirmed: "INTEGER NOT NULL DEFAULT 0",
    email_confirm_token: "TEXT",
    email_confirm_sent_at: "DATETIME",
    session_epoch: "INTEGER NOT NULL DEFAULT 0",
  },
  endorsements: {
    reviewer_linkedin: "TEXT",
    confirm_token: "TEXT",
    confirm_sent_at: "DATETIME",
    manage_token: "TEXT",
  },
};

/** True when an ISO/SQLite timestamp is older than maxAgeMs from now. */
function isExpired(sentAt: string | null, maxAgeMs: number): boolean {
  if (!sentAt) return true;
  // SQLite CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS" with no zone marker.
  const ms = Date.parse(
    sentAt.includes("T") ? sentAt : `${sentAt.replace(" ", "T")}Z`,
  );
  if (Number.isNaN(ms)) return true;
  return Date.now() - ms > maxAgeMs;
}

function migrate(db: Database.Database) {
  for (const [table, cols] of Object.entries(EXPECTED_COLUMNS)) {
    const existing = new Set(
      (
        db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
      ).map((c) => c.name),
    );
    // Empty == table doesn't exist yet (fresh DB). schema.sql's CREATE TABLE
    // will define every column, so there's nothing to reconcile — skip, and
    // crucially don't ALTER a non-existent table (that throws).
    if (existing.size === 0) continue;
    for (const [name, def] of Object.entries(cols)) {
      if (!existing.has(name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
      }
    }
  }
}

/**
 * On legacy databases the endorsements table may already contain duplicate
 * pending rows for the same (user_id, reviewer_email). The unique partial index
 * in schema.sql can't be created while those exist, so we resolve them first by
 * declining all but the most recent — non-destructive (rows are kept, just
 * moved out of the pending state) and idempotent.
 */
function dedupePending(db: Database.Database) {
  const hasTable = db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'endorsements'`,
    )
    .get();
  if (!hasTable) return; // fresh database — nothing to reconcile

  const info = db
    .prepare(
      `UPDATE endorsements
       SET status = 'declined',
           resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)
       WHERE status = 'pending'
         AND id NOT IN (
           SELECT MAX(id) FROM endorsements
           WHERE status = 'pending'
           GROUP BY user_id, reviewer_email
         )`,
    )
    .run();
  if (info.changes > 0) {
    console.warn(
      `[db] Declined ${info.changes} duplicate pending endorsement(s) to enforce the per-reviewer uniqueness constraint.`,
    );
  }
}

function connect(): Database.Database {
  // MYVOUCH_DB_PATH lets tests point at a throwaway database; defaults to the
  // app's myvouch.db in the project root.
  const dbPath =
    process.env.MYVOUCH_DB_PATH ?? path.join(process.cwd(), "myvouch.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  // Enforce REFERENCES ... ON DELETE CASCADE. SQLite leaves foreign keys OFF by
  // default and the setting is per-connection, so without this the cascades on
  // endorsements/audit_log silently never fire (orphan rows on user delete).
  db.pragma("foreign_keys = ON");
  // Order matters on legacy databases:
  //  1. dedupePending — clear duplicate pendings before the unique partial index.
  //  2. migrate       — ALTER missing columns onto EXISTING tables. Must precede
  //                     schema.sql so indexes built on newly-added columns
  //                     (e.g. idx_end_manage on manage_token) don't reference a
  //                     column that doesn't exist yet. No-ops on a fresh DB.
  //  3. schema.sql    — CREATE TABLE IF NOT EXISTS (defines all columns on a
  //                     fresh DB) + (re)create indexes, now that columns exist.
  dedupePending(db);
  migrate(db);
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

export function db(): Database.Database {
  if (!globalForDb.__myvouchDb) globalForDb.__myvouchDb = connect();
  return globalForDb.__myvouchDb;
}

/* ---------------- Users ---------------- */

export function createUser(u: {
  name: string;
  email: string;
  password_hash: string;
  slug: string;
  headline?: string | null;
  location?: string | null;
}): number {
  const info = db()
    .prepare(
      `INSERT INTO users (name, email, password_hash, slug, headline, location)
       VALUES (@name, @email, @password_hash, @slug, @headline, @location)`,
    )
    .run({
      name: u.name,
      email: u.email,
      password_hash: u.password_hash,
      slug: u.slug,
      headline: u.headline ?? null,
      location: u.location ?? null,
    });
  return Number(info.lastInsertRowid);
}

export function getUserByEmail(email: string): User | undefined {
  return db().prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | User
    | undefined;
}

export function getUserById(id: number): User | undefined {
  return db().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | User
    | undefined;
}

export function getUserBySlug(slug: string): User | undefined {
  return db().prepare("SELECT * FROM users WHERE slug = ?").get(slug) as
    | User
    | undefined;
}

export function slugExists(slug: string): boolean {
  return !!db().prepare("SELECT 1 FROM users WHERE slug = ?").get(slug);
}

/** Update an owner's editable profile fields. Returns true if a row changed. */
export function updateProfile(
  userId: number,
  p: {
    headline: string | null;
    location: string | null;
    linkedin_url: string | null;
    open_to_work: number;
  },
): boolean {
  const info = db()
    .prepare(
      `UPDATE users
       SET headline = @headline, location = @location,
           linkedin_url = @linkedin_url, open_to_work = @open_to_work
       WHERE id = @id`,
    )
    .run({
      id: userId,
      headline: p.headline,
      location: p.location,
      linkedin_url: p.linkedin_url,
      open_to_work: p.open_to_work,
    });
  return info.changes > 0;
}

/** Replace a user's password hash. Pair with bumpSessionEpoch to revoke sessions. */
export function updatePassword(userId: number, passwordHash: string): boolean {
  const info = db()
    .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .run(passwordHash, userId);
  return info.changes > 0;
}

/**
 * Invalidate all existing sessions for a user by bumping their session epoch.
 * Signed tokens embed the epoch; a mismatch is rejected in verifySessionToken.
 */
export function bumpSessionEpoch(userId: number): number {
  const row = db()
    .prepare(
      `UPDATE users SET session_epoch = session_epoch + 1 WHERE id = ?
       RETURNING session_epoch`,
    )
    .get(userId) as { session_epoch: number } | undefined;
  return row?.session_epoch ?? 0;
}

/* ---------------- Owner email verification ---------------- */

/** Store a fresh owner-email confirmation token and stamp the send time. */
export function setEmailConfirmToken(userId: number, token: string): void {
  db()
    .prepare(
      `UPDATE users
       SET email_confirm_token = ?, email_confirm_sent_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(token, userId);
}

export type ConfirmResult = "ok" | "expired" | "invalid";

/**
 * Confirm an owner's own email via the one-time token. Sets email_confirmed,
 * clears the token. Returns "expired" when the link is older than CONFIRM_TTL_MS
 * (so the caller can offer a resend) vs "invalid" for an unknown/used token.
 */
export function confirmUserEmail(token: string): ConfirmResult {
  const row = db()
    .prepare(
      `SELECT id, email_confirm_sent_at AS sentAt FROM users WHERE email_confirm_token = ?`,
    )
    .get(token) as { id: number; sentAt: string | null } | undefined;
  if (!row) return "invalid";
  if (isExpired(row.sentAt, CONFIRM_TTL_MS)) return "expired";
  db()
    .prepare(
      `UPDATE users SET email_confirmed = 1, email_confirm_token = NULL WHERE id = ?`,
    )
    .run(row.id);
  return "ok";
}

/**
 * True when the user may be sent another confirmation email (cooldown elapsed).
 * Guards the owner-initiated resend route against email spamming.
 */
export function canResendUserConfirm(userId: number): boolean {
  const row = db()
    .prepare(`SELECT email_confirm_sent_at AS sentAt FROM users WHERE id = ?`)
    .get(userId) as { sentAt: string | null } | undefined;
  if (!row) return false;
  return isExpired(row.sentAt, RESEND_COOLDOWN_MS);
}

/* ---------------- Audit log ---------------- */

/** Append a sensitive-action record (password change, moderation, edit, …). */
export function appendAuditLog(
  userId: number,
  action: string,
  detail?: string | null,
): void {
  db()
    .prepare(`INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)`)
    .run(userId, action, detail ?? null);
}

/* ---------------- Endorsements ---------------- */

/**
 * Insert an endorsement. The unique partial index on (user_id, reviewer_email)
 * WHERE status='pending' blocks duplicate pending submissions (#8); callers
 * should surface a friendly 409 when this throws a SQLITE_CONSTRAINT error.
 */
export function createEndorsement(e: {
  user_id: number;
  reviewer_name: string;
  reviewer_email: string;
  reviewer_role?: string | null;
  reviewer_company?: string | null;
  reviewer_linkedin?: string | null;
  relationship: Relationship;
  rating: number;
  body: string;
  strengths?: string[] | null;
  email_confirmed?: boolean;
  employer_overlap_verified?: boolean;
  linkedin_matched?: boolean;
  confirm_token?: string | null;
  manage_token?: string | null;
}): number {
  const info = db()
    .prepare(
      `INSERT INTO endorsements
       (user_id, reviewer_name, reviewer_email, reviewer_role, reviewer_company,
        reviewer_linkedin, relationship, rating, body, strengths, email_confirmed,
        employer_overlap_verified, linkedin_matched, confirm_token, confirm_sent_at,
        manage_token)
       VALUES
       (@user_id, @reviewer_name, @reviewer_email, @reviewer_role, @reviewer_company,
        @reviewer_linkedin, @relationship, @rating, @body, @strengths, @email_confirmed,
        @employer_overlap_verified, @linkedin_matched, @confirm_token,
        CASE WHEN @confirm_token IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END,
        @manage_token)`,
    )
    .run({
      user_id: e.user_id,
      reviewer_name: e.reviewer_name,
      reviewer_email: e.reviewer_email,
      reviewer_role: e.reviewer_role ?? null,
      reviewer_company: e.reviewer_company ?? null,
      reviewer_linkedin: e.reviewer_linkedin ?? null,
      relationship: e.relationship,
      rating: e.rating,
      body: e.body,
      strengths: e.strengths?.length ? JSON.stringify(e.strengths) : null,
      email_confirmed: e.email_confirmed ? 1 : 0,
      employer_overlap_verified: e.employer_overlap_verified ? 1 : 0,
      linkedin_matched: e.linkedin_matched ? 1 : 0,
      confirm_token: e.confirm_token ?? null,
      manage_token: e.manage_token ?? null,
    });
  return Number(info.lastInsertRowid);
}

export interface Page {
  limit?: number;
  offset?: number;
}

/**
 * Opaque keyset cursor for the public wall. Encodes the (resolved_at, id) of the
 * last row a client has seen; the next page is everything strictly "after" it in
 * the wall's `resolved_at DESC, id DESC` order. Keyset (vs OFFSET) keeps deep
 * pages O(limit) instead of O(offset) and is stable as new rows are published.
 */
export interface Cursor {
  resolvedAt: string;
  id: number;
}

export function encodeCursor(e: {
  resolved_at: string | null;
  id: number;
}): string | null {
  if (!e.resolved_at) return null;
  return Buffer.from(`${e.resolved_at}|${e.id}`, "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.lastIndexOf("|");
    if (sep < 0) return null;
    const resolvedAt = decoded.slice(0, sep);
    const id = Number(decoded.slice(sep + 1));
    if (!resolvedAt || !Number.isInteger(id)) return null;
    return { resolvedAt, id };
  } catch {
    return null;
  }
}

export function getApprovedEndorsements(
  userId: number,
  opts: { limit?: number; cursor?: Cursor | null } = {},
): Endorsement[] {
  const limit = opts.limit ?? PAGE_SIZE;
  const cursor = opts.cursor ?? null;
  // Approved rows always carry a resolved_at, so the keyset comparison is total.
  if (cursor) {
    return db()
      .prepare(
        `SELECT * FROM endorsements
         WHERE user_id = ? AND status = 'approved'
           AND (resolved_at < @ra OR (resolved_at = @ra AND id < @id))
         ORDER BY resolved_at DESC, id DESC
         LIMIT @limit`,
      )
      .all(userId, {
        ra: cursor.resolvedAt,
        id: cursor.id,
        limit,
      }) as Endorsement[];
  }
  return db()
    .prepare(
      `SELECT * FROM endorsements WHERE user_id = ? AND status = 'approved'
       ORDER BY resolved_at DESC, id DESC
       LIMIT ?`,
    )
    .all(userId, limit) as Endorsement[];
}

export function countApprovedEndorsements(userId: number): number {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS c FROM endorsements WHERE user_id = ? AND status = 'approved'`,
    )
    .get(userId) as { c: number };
  return row.c;
}

export interface ApprovedStats {
  total: number;
  emailVerified: number;
  avgRating: number | null;
  recommendPct: number; // share of approved endorsements rated >= 4
}

/** Aggregate stats over ALL approved endorsements (independent of pagination). */
export function getApprovedStats(userId: number): ApprovedStats {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(email_confirmed) AS emailVerified,
              AVG(rating) AS avgRating,
              SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) AS recommend
       FROM endorsements WHERE user_id = ? AND status = 'approved'`,
    )
    .get(userId) as {
    total: number;
    emailVerified: number | null;
    avgRating: number | null;
    recommend: number | null;
  };
  return {
    total: row.total,
    emailVerified: row.emailVerified ?? 0,
    avgRating: row.avgRating,
    recommendPct: row.total
      ? Math.round(((row.recommend ?? 0) / row.total) * 100)
      : 0,
  };
}

export function getEndorsementsForOwner(
  userId: number,
  page: Page = {},
): Endorsement[] {
  const limit = page.limit ?? PAGE_SIZE;
  const offset = page.offset ?? 0;
  return db()
    .prepare(
      `SELECT * FROM endorsements WHERE user_id = ?
       ORDER BY submitted_at DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset) as Endorsement[];
}

export function countEndorsementsForOwner(userId: number): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS c FROM endorsements WHERE user_id = ?`)
    .get(userId) as { c: number };
  return row.c;
}

export function moderateEndorsement(
  id: number,
  ownerId: number,
  status: Status,
): boolean {
  const info = db()
    .prepare(
      `UPDATE endorsements
       SET status = ?,
           resolved_at = CASE WHEN ? = 'pending' THEN NULL ELSE CURRENT_TIMESTAMP END
       WHERE id = ? AND user_id = ?`,
    )
    .run(status, status, id, ownerId);
  return info.changes > 0;
}

/** Owner-scoped permanent removal of an endorsement. */
export function deleteEndorsement(id: number, ownerId: number): boolean {
  const info = db()
    .prepare(`DELETE FROM endorsements WHERE id = ? AND user_id = ?`)
    .run(id, ownerId);
  return info.changes > 0;
}

/** Owner-scoped edit of an endorsement's body text (e.g. trimming/typo fixes). */
export function updateEndorsementBody(
  id: number,
  ownerId: number,
  body: string,
): boolean {
  const info = db()
    .prepare(`UPDATE endorsements SET body = ? WHERE id = ? AND user_id = ?`)
    .run(body, id, ownerId);
  return info.changes > 0;
}

/** Owner-scoped toggle of a manual verification signal (currently LinkedIn). */
export function setLinkedInMatched(
  id: number,
  ownerId: number,
  matched: boolean,
): boolean {
  const info = db()
    .prepare(
      `UPDATE endorsements SET linkedin_matched = ? WHERE id = ? AND user_id = ?`,
    )
    .run(matched ? 1 : 0, id, ownerId);
  return info.changes > 0;
}

/**
 * Confirm a reviewer's email via the one-time token. Sets email_confirmed and
 * clears the token. Returns the owning user's slug on success, or a status so
 * the caller can distinguish an expired link (offer resend) from an unknown one.
 */
export function confirmEndorsementEmail(token: string): {
  result: ConfirmResult;
  slug?: string;
} {
  const row = db()
    .prepare(
      `SELECT e.id AS id, e.confirm_sent_at AS sentAt, u.slug AS slug
       FROM endorsements e JOIN users u ON u.id = e.user_id
       WHERE e.confirm_token = ?`,
    )
    .get(token) as
    | { id: number; sentAt: string | null; slug: string }
    | undefined;
  if (!row) return { result: "invalid" };
  if (isExpired(row.sentAt, CONFIRM_TTL_MS))
    return { result: "expired", slug: row.slug };
  db()
    .prepare(
      `UPDATE endorsements SET email_confirmed = 1, confirm_token = NULL WHERE id = ?`,
    )
    .run(row.id);
  return { result: "ok", slug: row.slug };
}

/**
 * Mint a fresh confirm token for a still-pending, still-unconfirmed endorsement
 * so a reviewer who lost the email can request a new link. Rotates the token and
 * bumps confirm_sent_at (resetting TTL). Returns the new token, or null when:
 * no matching pending endorsement, already confirmed, or the cooldown hasn't
 * elapsed (prevents email spam). The unique-pending index guarantees at most one.
 */
export function rotateEndorsementConfirmToken(
  userId: number,
  reviewerEmail: string,
  newToken: string,
): string | null {
  const row = db()
    .prepare(
      `SELECT id, confirm_sent_at AS sentAt FROM endorsements
       WHERE user_id = ? AND reviewer_email = ? AND status = 'pending'
         AND email_confirmed = 0`,
    )
    .get(userId, reviewerEmail) as
    | { id: number; sentAt: string | null }
    | undefined;
  if (!row) return null;
  // Cooldown: only resend once the previous send is older than the cooldown.
  if (!isExpired(row.sentAt, RESEND_COOLDOWN_MS)) return null;
  db()
    .prepare(
      `UPDATE endorsements
       SET confirm_token = ?, confirm_sent_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .run(newToken, row.id);
  return newToken;
}

/* ---------------- Reviewer self-service (withdraw) ---------------- */

/** Minimal view a reviewer sees on /manage/[token] before withdrawing. */
export interface ManageView {
  reviewer_name: string;
  status: Status;
  owner_name: string;
  owner_slug: string;
}

/** Look up an endorsement by its stable manage_token (reviewer-held secret). */
export function getEndorsementByManageToken(
  token: string,
): ManageView | undefined {
  return db()
    .prepare(
      `SELECT e.reviewer_name AS reviewer_name, e.status AS status,
              u.name AS owner_name, u.slug AS owner_slug
       FROM endorsements e JOIN users u ON u.id = e.user_id
       WHERE e.manage_token = ?`,
    )
    .get(token) as ManageView | undefined;
}

/**
 * Reviewer withdraws their own endorsement via the manage_token from their email.
 * A withdrawal is a hard delete — the reviewer owns their words and asked for
 * them gone. Returns true when a row was removed (idempotent: false if already
 * withdrawn or the token is unknown).
 */
export function withdrawEndorsementByManageToken(token: string): boolean {
  const info = db()
    .prepare(`DELETE FROM endorsements WHERE manage_token = ?`)
    .run(token);
  return info.changes > 0;
}

/* ---------------- Audit log read ---------------- */

export interface AuditEntry {
  id: number;
  action: string;
  detail: string | null;
  created_at: string;
}

/** Most-recent-first slice of an owner's sensitive-action history. */
export function getAuditLog(userId: number, limit = 50): AuditEntry[] {
  return db()
    .prepare(
      `SELECT id, action, detail, created_at FROM audit_log
       WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(userId, limit) as AuditEntry[];
}

/* ---------------- Email outbox ---------------- */

export interface OutboxRow {
  id: number;
  recipient: string;
  subject: string;
  html: string;
  body_text: string;
  attempts: number;
}

/** Persist a mail for durable, retryable delivery. Returns the new row id. */
export function enqueueOutbox(m: {
  recipient: string;
  subject: string;
  html: string;
  text: string;
}): number {
  const info = db()
    .prepare(
      `INSERT INTO email_outbox (recipient, subject, html, body_text)
       VALUES (@recipient, @subject, @html, @body_text)`,
    )
    .run({
      recipient: m.recipient,
      subject: m.subject,
      html: m.html,
      body_text: m.text,
    });
  return Number(info.lastInsertRowid);
}

/** Unsent rows still under the retry cap, oldest first (for the delivery sweep). */
export function pendingOutbox(maxAttempts: number, limit: number): OutboxRow[] {
  return db()
    .prepare(
      `SELECT id, recipient, subject, html, body_text, attempts FROM email_outbox
       WHERE sent_at IS NULL AND attempts < ?
       ORDER BY id ASC LIMIT ?`,
    )
    .all(maxAttempts, limit) as OutboxRow[];
}

export function markOutboxSent(id: number): void {
  db()
    .prepare(`UPDATE email_outbox SET sent_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(id);
}

export function markOutboxFailed(id: number, error: string): void {
  db()
    .prepare(
      `UPDATE email_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
    )
    .run(error.slice(0, 500), id);
}
