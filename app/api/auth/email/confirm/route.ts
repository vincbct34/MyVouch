import { NextResponse } from "next/server";
import { confirmUserEmail } from "@/lib/db";
import { apiMessages } from "@/lib/apimsg";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";

/** Confirm the owner's own email via the one-time token from the signup mail. */
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
      key: `econfirm:token:${token.slice(0, 16)}`,
      limit: 10,
      windowMs: 10 * 60_000,
    },
    { key: `econfirm:ip:${clientIp(req)}`, limit: 100, windowMs: 10 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: apiMessages(req).api.tooManyAttempts },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const result = confirmUserEmail(token);
  if (result === "expired")
    return NextResponse.json(
      {
        error: apiMessages(req).api.emailLinkExpired,
      },
      { status: 410 },
    );
  if (result === "invalid")
    return NextResponse.json(
      { error: apiMessages(req).api.linkUsed },
      { status: 404 },
    );

  return NextResponse.json({ ok: true });
}
