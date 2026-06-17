import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getUserBySlug, rotateEndorsementConfirmToken } from "@/lib/db";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";
import { enqueueMail } from "@/lib/outbox";
import { appBaseUrl } from "@/lib/url";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Resend a reviewer's endorsement-confirmation link. A lost or expired email
 * would otherwise be a dead-end (the unique-pending index blocks resubmitting).
 * Mints a fresh token for the still-pending, still-unconfirmed endorsement,
 * cooldown-gated in the data layer. Response is always generic so it never
 * reveals whether a given email has a pending endorsement on a profile.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim();
  const reviewer_email = String(body.reviewer_email ?? "")
    .trim()
    .toLowerCase();
  if (!slug || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reviewer_email))
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const limited = rateLimitAll([
    {
      key: `eresend:rev:${slug}:${reviewer_email}`,
      limit: 3,
      windowMs: 30 * 60_000,
    },
    {
      key: `eresend:rev:ip:${clientIp(req)}`,
      limit: 20,
      windowMs: 30 * 60_000,
    },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const owner = getUserBySlug(slug);
  // Generic OK regardless of whether a pending endorsement exists (no enumeration).
  if (owner) {
    const token = crypto.randomBytes(32).toString("hex");
    const rotated = rotateEndorsementConfirmToken(
      owner.id,
      reviewer_email,
      token,
    );
    if (rotated) {
      const link = `${appBaseUrl(req)}/confirm/${rotated}`;
      enqueueMail({
        to: reviewer_email,
        subject: `Confirm your endorsement of ${owner.name}`,
        text: `Here's a fresh link to confirm your endorsement of ${owner.name}:\n\n${link}\n`,
        html: `<p>Here's a fresh link to confirm your endorsement of <strong>${escapeHtml(owner.name)}</strong>:</p><p><a href="${link}">Confirm my endorsement</a></p>`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
