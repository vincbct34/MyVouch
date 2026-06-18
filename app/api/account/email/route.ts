import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { apiMessages } from "@/lib/apimsg";
import {
  getUserByEmail,
  updateEmail,
  setEmailConfirmToken,
  appendAuditLog,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { verifyPassword } from "@/lib/auth";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";
import { enqueueMail } from "@/lib/outbox";
import { appBaseUrl } from "@/lib/url";

/**
 * Owner changes their account email. The new address starts unverified: we reset
 * email_confirmed and mail a fresh confirmation link, mirroring signup. Guarded
 * by the standard same-origin → auth → rate-limit chain, plus a current-password
 * check so a hijacked-but-idle session can't quietly redirect the account.
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
    { key: `emailchange:user:${user.id}`, limit: 10, windowMs: 15 * 60_000 },
    {
      key: `emailchange:ip:${clientIp(req)}`,
      limit: 50,
      windowMs: 15 * 60_000,
    },
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

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json(
      { error: apiMessages(req).api.enterEmail },
      { status: 400 },
    );
  if (email.length > 254)
    return NextResponse.json(
      { error: apiMessages(req).api.emailLong },
      { status: 400 },
    );
  if (email === user.email)
    return NextResponse.json(
      { error: apiMessages(req).api.emailSame },
      { status: 400 },
    );

  if (!verifyPassword(password, user.password_hash))
    return NextResponse.json(
      { error: apiMessages(req).api.currentPwWrong },
      { status: 401 },
    );

  // Uniqueness: the DB has a UNIQUE index, but pre-check for a friendly 409.
  if (getUserByEmail(email))
    return NextResponse.json(
      { error: apiMessages(req).api.accountExists },
      { status: 409 },
    );

  updateEmail(user.id, email);
  appendAuditLog(user.id, "email.change", email);

  const token = crypto.randomBytes(32).toString("hex");
  setEmailConfirmToken(user.id, token);
  const link = `${appBaseUrl(req)}/confirm-email/${token}`;
  enqueueMail({
    to: email,
    subject: apiMessages(req).email.ownerSubject,
    text: apiMessages(req).email.ownerResendText(link),
    html: apiMessages(req).email.ownerResendHtml(link),
  });

  return NextResponse.json({ ok: true });
}
