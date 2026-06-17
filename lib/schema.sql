-- Canonical Vouch schema. Single source of truth, shared by lib/db.ts and
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
  identity_verified INTEGER NOT NULL DEFAULT 0,
  open_to_work INTEGER NOT NULL DEFAULT 0,
  -- Owner's OWN email, confirmed via /confirm-email/[token]. The employer-overlap
  -- signal on incoming endorsements is only credited when this is 1, so an
  -- unverified owner can't manufacture a "same company" badge (trust gate).
  email_confirmed INTEGER NOT NULL DEFAULT 0,
  email_confirm_token TEXT,
  email_confirm_sent_at DATETIME,
  session_epoch INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_end_user ON endorsements(user_id);
CREATE INDEX IF NOT EXISTS idx_end_status ON endorsements(status);
CREATE INDEX IF NOT EXISTS idx_end_confirm ON endorsements(confirm_token);
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
