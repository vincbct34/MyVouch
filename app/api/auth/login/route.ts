import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import {
  verifyPassword,
  dummyVerify,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");

  // Throttle credential attempts: 10 per 5 min per account AND per IP, so an IP
  // flood can't lock out unrelated accounts (and vice versa).
  const limited = rateLimitAll([
    { key: `login:email:${email}`, limit: 10, windowMs: 5 * 60_000 },
    { key: `login:ip:${clientIp(req)}`, limit: 50, windowMs: 5 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  if (email.length > 254 || password.length > 256) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  const user = getUserByEmail(email);
  if (!user) {
    // Spend equivalent scrypt time so timing doesn't reveal the email exists.
    dummyVerify(password);
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }
  if (!verifyPassword(password, user.password_hash)) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true, slug: user.slug });
  res.cookies.set(
    SESSION_COOKIE,
    createSessionToken(user.id, user.session_epoch),
    sessionCookieOptions,
  );
  return res;
}
