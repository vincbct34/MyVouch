import { cookies } from "next/headers";
import { getUserById, type User } from "./db";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

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
