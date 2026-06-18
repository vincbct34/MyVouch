import { NextResponse } from "next/server";
import { apiMessages } from "@/lib/apimsg";
import { deleteUser } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { verifyPassword, SESSION_COOKIE } from "@/lib/auth";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";

/**
 * Permanently delete the owner's account. Irreversible: the ON DELETE CASCADE
 * foreign keys take their endorsements, audit log, and avatar with it. Double
 * guarded — the owner must re-enter their password AND type their public slug to
 * confirm — on top of the standard same-origin → auth → rate-limit chain.
 */
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

  const limited = rateLimitAll([
    { key: `delete:user:${user.id}`, limit: 5, windowMs: 15 * 60_000 },
    { key: `delete:ip:${clientIp(req)}`, limit: 20, windowMs: 15 * 60_000 },
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

  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? "").trim();

  if (!verifyPassword(password, user.password_hash))
    return NextResponse.json(
      { error: apiMessages(req).api.currentPwWrong },
      { status: 401 },
    );

  // Typed confirmation must match the public slug exactly.
  if (confirm !== user.slug)
    return NextResponse.json(
      { error: apiMessages(req).api.deleteConfirmMismatch },
      { status: 400 },
    );

  deleteUser(user.id);

  // Clear the now-orphaned session cookie. The user row is gone, so even a
  // surviving token copy resolves to no user in getCurrentUser.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
