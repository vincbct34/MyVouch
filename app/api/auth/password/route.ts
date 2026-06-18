import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { apiMessages } from "@/lib/apimsg";
import { updatePassword, bumpSessionEpoch, appendAuditLog } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json(
      { error: apiMessages(req).api.invalidRequest },
      { status: 403 },
    );

  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: apiMessages(req).api.notAuthenticated },
      { status: 401 },
    );

  // Throttle current-password guessing: per account AND per IP.
  const limited = rateLimitAll([
    { key: `pwchange:user:${user.id}`, limit: 10, windowMs: 15 * 60_000 },
    { key: `pwchange:ip:${clientIp(req)}`, limit: 50, windowMs: 15 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: apiMessages(req).api.tooManyAttempts },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
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

  const current = String(body.current_password ?? "");
  const next = String(body.new_password ?? "");

  if (next.length < 8)
    return NextResponse.json(
      {
        error: apiMessages(req).api.newPwMin,
      },
      { status: 400 },
    );
  if (next.length > 256)
    return NextResponse.json(
      {
        error: apiMessages(req).api.newPwMax,
      },
      { status: 400 },
    );

  if (!verifyPassword(current, user.password_hash))
    return NextResponse.json(
      { error: apiMessages(req).api.currentPwWrong },
      { status: 401 },
    );

  if (verifyPassword(next, user.password_hash))
    return NextResponse.json(
      { error: apiMessages(req).api.newPwDifferent },
      { status: 400 },
    );

  updatePassword(user.id, hashPassword(next));
  appendAuditLog(user.id, "password.change");
  // Revoke every existing session (including this one's token)...
  const epoch = bumpSessionEpoch(user.id);
  // ...then re-issue a fresh token for the current device so the user stays in.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    SESSION_COOKIE,
    createSessionToken(user.id, epoch),
    sessionCookieOptions,
  );
  return res;
}
