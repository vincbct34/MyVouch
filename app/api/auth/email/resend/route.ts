import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { setEmailConfirmToken, canResendUserConfirm } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";
import { enqueueMail } from "@/lib/outbox";
import { appBaseUrl } from "@/lib/url";

/** Owner-initiated resend of their own email confirmation link (cooldown-gated). */
export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (user.email_confirmed)
    return NextResponse.json({ ok: true, alreadyConfirmed: true });

  const limited = rateLimitAll([
    { key: `eresend:user:${user.id}`, limit: 5, windowMs: 60 * 60_000 },
    { key: `eresend:ip:${clientIp(req)}`, limit: 20, windowMs: 60 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  // Cooldown so a fresh link can't be minted on every click.
  if (!canResendUserConfirm(user.id))
    return NextResponse.json(
      { error: "A confirmation email was just sent. Check your inbox." },
      { status: 429 },
    );

  const token = crypto.randomBytes(32).toString("hex");
  setEmailConfirmToken(user.id, token);
  const link = `${appBaseUrl(req)}/confirm-email/${token}`;
  enqueueMail({
    to: user.email,
    subject: "Confirm your email for MyVouch",
    text: `Confirm your email to unlock verified endorsement signals:\n\n${link}\n`,
    html: `<p>Confirm your email to unlock verified endorsement signals:</p><p><a href="${link}">Confirm my email</a></p>`,
  });

  return NextResponse.json({ ok: true });
}
