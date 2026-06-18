import { NextResponse } from "next/server";
import { withdrawEndorsementByManageToken } from "@/lib/db";
import { apiMessages } from "@/lib/apimsg";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";

/**
 * Reviewer withdraws their own endorsement using the stable manage_token mailed
 * to them on submit. The token is the only credential (no account), so the same
 * guard order as every other mutating route applies: same-origin → rate limit →
 * act. The delete is idempotent, and the response is generic either way so the
 * token can't be used to probe which endorsements still exist.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json(
      { error: apiMessages(req).api.invalidRequest },
      { status: 403 },
    );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: apiMessages(req).api.invalidRequest },
      { status: 400 },
    );
  }

  const token = String(body.token ?? "").trim();
  if (!/^[a-f0-9]{64}$/.test(token))
    return NextResponse.json(
      { error: apiMessages(req).api.invalidLink },
      { status: 400 },
    );

  const limited = rateLimitAll([
    {
      key: `withdraw:token:${token.slice(0, 16)}`,
      limit: 10,
      windowMs: 600_000,
    },
    { key: `withdraw:ip:${clientIp(req)}`, limit: 60, windowMs: 600_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: apiMessages(req).api.tooManyAttempts },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  withdrawEndorsementByManageToken(token);
  return NextResponse.json({ ok: true });
}
