-- Canonical MyVouch schema. Single source of truth, shared by lib/db.ts and
-- scripts/seed.mjs. Columns added over time are reconciled onto existing
-- databases by the migrate() routine in lib/db.ts (ALTER TABLE ADD COLUMN).

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT,
  location TEXT,
  linkedin_url TEXT,
  open_to_work INTEGER NOT NULL DEFAULT 0,
  -- Owner's OWN email, confirmed via /confirm-email/[token]. The employer-overlap
  -- signal on incoming endorsements is only credited when this is 1, so an
  -- unverified owner can't manufacture a "same company" badge (trust gate).
  email_confirmed INTEGER NOT NULL DEFAULT 0,
  email_confirm_token TEXT,
  email_confirm_sent_at DATETIME,
  session_epoch INTEGER NOT NULL DEFAULT 0,
  -- Set whenever the owner uploads a profile photo, cleared on removal. NULL
  -- means "no photo" (fall back to generated initials). The bytes live in the
  -- separate user_avatars table so SELECT * on users never drags the BLOB into
  -- the per-request session User object; this timestamp also cache-busts the
  -- public /api/u/[slug]/avatar URL.
  avatar_updated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Profile photos, one row per user, kept apart from the users table so the
-- image bytes are only read when actually serving the avatar. ON DELETE CASCADE
-- removes the photo with the account.
CREATE TABLE IF NOT EXISTS user_avatars (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bytes BLOB NOT NULL,
  mime TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS endorsements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  reviewer_role TEXT,
  reviewer_company TEXT,
  reviewer_linkedin TEXT,
  relationship TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL,
  strengths TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  email_confirmed INTEGER NOT NULL DEFAULT 0,
  employer_overlap_verified INTEGER NOT NULL DEFAULT 0,
  linkedin_matched INTEGER NOT NULL DEFAULT 0,
  confirm_token TEXT,
  confirm_sent_at DATETIME,
  -- Stable per-endorsement token (never cleared) backing the reviewer's
  -- self-service /manage/[token] page, where they can withdraw what they wrote.
  manage_token TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_end_user ON endorsements(user_id);
CREATE INDEX IF NOT EXISTS idx_end_confirm ON endorsements(confirm_token);
CREATE INDEX IF NOT EXISTS idx_end_manage ON endorsements(manage_token);
-- The public wall's hot query: approved rows for one owner, newest first.
-- Composite (user_id, status, resolved_at, id) lets SQLite satisfy the filter
-- AND the ORDER BY / keyset cursor from the index alone. Supersedes the old
-- single-column idx_end_status (dropped below), which couldn't serve the sort.
DROP INDEX IF EXISTS idx_end_status;
CREATE INDEX IF NOT EXISTS idx_end_wall
  ON endorsements(user_id, status, resolved_at DESC, id DESC);
-- One pending endorsement per (profile, reviewer email): blocks queue flooding (#8).
CREATE UNIQUE INDEX IF NOT EXISTS idx_end_pending_dedup
  ON endorsements(user_id, reviewer_email)
  WHERE status = 'pending';

-- Append-only trail of sensitive actions (password change, logout-all,
-- moderation, endorsement edit/delete). Gives a dispute history; no UI yet.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email_confirm ON users(email_confirm_token);

-- Durable email outbox. Confirmation/resend mails are enqueued here first, then
-- sent best-effort out of the request path; a periodic sweep retries rows that
-- failed or were never picked up, so a provider blip never silently loses a
-- verification link. attempts caps retries; sent_at NULL = still pending.
CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Sweep predicate: unsent rows under the retry cap, oldest first.
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON email_outbox(sent_at, attempts);
