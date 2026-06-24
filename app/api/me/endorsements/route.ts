import { NextResponse } from "next/server";
import { apiMessages } from "@/lib/apimsg";
import {
  getEndorsementsForOwner,
  countEndorsementsForOwner,
  toOwnerEndorsement,
  PAGE_SIZE,
} from "@/lib/db";
import { getApiUser } from "@/lib/session";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";

const MAX_LIMIT = 100;

/**
 * Private, Bearer-authenticated read of the caller's own endorsements — ALL of
 * them, including pending and declined (unlike the public wall endpoint). The
 * API token is the credential, so this is intentionally cross-origin friendly:
 * no same-origin/CSRF gate (there's no ambient cookie to forge), just token auth
 * then a rate limit on both the token's user and the client IP.
 */
export async function GET(req: Request) {
  const user = getApiUser(req);
  if (!user)
    return NextResponse.json(
      { error: apiMessages(req).api.invalidToken },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );

  const limited = rateLimitAll([
    { key: `meapi:user:${user.id}`, limit: 120, windowMs: 60_000 },
    { key: `meapi:ip:${clientIp(req)}`, limit: 240, windowMs: 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: apiMessages(req).api.tooManyRequests },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || PAGE_SIZE, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const rows = getEndorsementsForOwner(user.id, { limit, offset });
  return NextResponse.json({
    slug: user.slug,
    total: countEndorsementsForOwner(user.id),
    limit,
    offset,
    endorsements: rows.map(toOwnerEndorsement),
  });
}
