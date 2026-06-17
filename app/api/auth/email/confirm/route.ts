import { NextResponse } from "next/server";
import { confirmUserEmail } from "@/lib/db";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";

/** Confirm the owner's own email via the one-time token from the signup mail. */
export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  if (!/^[a-f0-9]{64}$/.test(token))
    return NextResponse.json({ error: "Invalid link." }, { status: 400 });

  const limited = rateLimitAll([
    {
      key: `econfirm:token:${token.slice(0, 16)}`,
      limit: 10,
      windowMs: 10 * 60_000,
    },
    { key: `econfirm:ip:${clientIp(req)}`, limit: 100, windowMs: 10 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const result = confirmUserEmail(token);
  if (result === "expired")
    return NextResponse.json(
      {
        error:
          "This link has expired. Sign in and resend it from your dashboard.",
      },
      { status: 410 },
    );
  if (result === "invalid")
    return NextResponse.json(
      { error: "This link is invalid or has already been used." },
      { status: 404 },
    );

  return NextResponse.json({ ok: true });
}
