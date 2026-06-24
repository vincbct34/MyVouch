import crypto from "node:crypto";

/**
 * Pure auth primitives: password hashing, session-token sign/verify, cookie
 * config. Intentionally free of Next.js runtime imports so it can be unit
 * tested in plain Node. The request-bound helper getCurrentUser lives in
 * lib/session.ts.
 */

function resolveSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const isPlaceholder =
    secret?.includes("change_me") || secret?.includes("replace_with");
  if (secret && secret.length >= 16 && !isPlaceholder) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production (>= 16 chars, not a placeholder). Set it in the environment.",
    );
  }
  return "myvouch-dev-secret-change-me-in-production";
}

export const SESSION_COOKIE = "myvouch_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/* ---------- Password hashing (scrypt) ---------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

// Precomputed valid salt:hash for a throwaway password. Used to spend the same
// scrypt cost on the "no such user" login path so response timing doesn't leak
// whether an email is registered (#5).
const DUMMY_HASH = hashPassword("myvouch-timing-equalizer");

/** Run a scrypt verification against a dummy hash; always returns false. */
export function dummyVerify(password: string): boolean {
  return verifyPassword(password, DUMMY_HASH);
}

/* ---------- Signed session tokens ---------- */

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", resolveSecret())
    .update(payload)
    .digest("hex");
}

export function createSessionToken(userId: number, epoch: number): string {
  const payload = `${userId}.${epoch}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export interface SessionClaims {
  userId: number;
  epoch: number;
}

/**
 * Validate a token's signature and expiry and return its claims. The caller
 * must still confirm the epoch matches the user's current session_epoch so
 * revoked sessions (logout-everywhere, password change) are rejected (#3).
 */
export function verifySessionToken(token: string): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, epoch, ts, sig] = parts;
  const payload = `${userId}.${epoch}.${ts}`;
  const expected = sign(payload);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  if (Date.now() - Number(ts) > MAX_AGE * 1000) return null;
  return { userId: Number(userId), epoch: Number(epoch) };
}

/* ---------- API tokens (programmatic access) ---------- */

// Human-recognisable prefix so a leaked token is greppable and self-identifying.
const API_TOKEN_PREFIX = "mv_";

/**
 * Mint a fresh raw API token. 256 bits of entropy, shown to the owner exactly
 * once at creation — only its hash is ever persisted (see hashApiToken).
 */
export function generateApiToken(): string {
  return API_TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
}

/**
 * Hash an API token for storage and lookup. Tokens are full-entropy random, so a
 * fast SHA-256 is the correct primitive here (scrypt's work factor is for
 * low-entropy passwords and would only slow every authed request). We never
 * persist the raw token, only this digest.
 */
export function hashApiToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
