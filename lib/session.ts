import { cookies } from "next/headers";
import { getUserById, getUserByApiTokenHash, type User } from "./db";
import { SESSION_COOKIE, verifySessionToken, hashApiToken } from "./auth";

/**
 * Resolve the current request's authenticated user from the session cookie.
 * Kept separate from lib/auth.ts because it imports next/headers and the data
 * layer; this is the request-bound seam, lib/auth.ts stays pure/testable.
 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;
  const user = getUserById(claims.userId);
  if (!user) return null;
  // Reject tokens issued before the user's session epoch was bumped (#3).
  if (user.session_epoch !== claims.epoch) return null;
  return user;
}

/**
 * Resolve the user behind a Bearer API token (programmatic access). The
 * Authorization header is the credential here, not the session cookie, so this
 * is the seam for cross-origin API clients. Revocation is a row delete (no epoch
 * check) — an absent/revoked token simply yields null. Takes the Request
 * directly so it works in route handlers without next/headers.
 */
export function getApiUser(req: Request): User | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return getUserByApiTokenHash(hashApiToken(token)) ?? null;
}
