import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  getUserBySlug,
  createEndorsement,
  getApprovedEndorsements,
  countApprovedEndorsements,
  toPublicEndorsement,
  PAGE_SIZE,
  type Relationship,
} from "@/lib/db";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";
import { employerOverlap } from "@/lib/verify";
import { sendMail } from "@/lib/email";
import { appBaseUrl } from "@/lib/url";
import { SKILL_OPTIONS } from "@/lib/ui";

const RELATIONSHIPS: Relationship[] = [
  "manager",
  "peer",
  "report",
  "client",
  "partner",
  "mentee",
];

const SKILLS = new Set(SKILL_OPTIONS);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    String((err as { code: unknown }).code).startsWith("SQLITE_CONSTRAINT")
  );
}

/** Public, read-only page of approved endorsements for the wall's "load more". */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const owner = getUserBySlug(slug);
  if (!owner)
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const url = new URL(req.url);
  const offset = Math.max(
    0,
    Math.floor(Number(url.searchParams.get("offset")) || 0),
  );
  const endorsements = getApprovedEndorsements(owner.id, {
    limit: PAGE_SIZE,
    offset,
  }).map(toPublicEndorsement);

  return NextResponse.json({
    endorsements,
    total: countApprovedEndorsements(owner.id),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  const { slug } = await params;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Bot defense (honeypot + timing). A filled honeypot or an implausibly fast
  // submit is almost certainly a bot. Respond 200-ok so bots get no signal to
  // tune against, but never persist. Checked before any expensive work.
  const honeypot = String(b.company_url ?? "").trim();
  const elapsedMs = Number(b.elapsed_ms);
  if (honeypot || (Number.isFinite(elapsedMs) && elapsedMs < 3000)) {
    return NextResponse.json({ ok: true });
  }

  const reviewer_name = String(b.reviewer_name ?? "").trim();
  const reviewer_email = String(b.reviewer_email ?? "")
    .trim()
    .toLowerCase();
  const reviewer_role = String(b.reviewer_role ?? "").trim() || null;
  const reviewer_company = String(b.reviewer_company ?? "").trim() || null;
  const reviewer_linkedin = String(b.reviewer_linkedin ?? "").trim() || null;
  const relationship = String(b.relationship ?? "") as Relationship;
  const rating = Number(b.rating);
  const body = String(b.body ?? "").trim();
  const strengths = Array.isArray(b.strengths)
    ? (b.strengths as unknown[])
        .map((s) => String(s).trim())
        .filter((s) => SKILLS.has(s))
        .slice(0, 8)
    : [];

  // Throttle submissions per (profile + reviewer) AND per IP, so a single IP
  // can't exhaust a shared bucket and block all submissions to a profile.
  const limited = rateLimitAll([
    {
      key: `endorse:${slug}:${reviewer_email}`,
      limit: 5,
      windowMs: 10 * 60_000,
    },
    { key: `endorse:ip:${clientIp(req)}`, limit: 30, windowMs: 10 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const owner = getUserBySlug(slug);
  if (!owner)
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  if (reviewer_name.length < 2)
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (reviewer_name.length > 120)
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reviewer_email))
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400 },
    );
  if (reviewer_email.length > 254)
    return NextResponse.json({ error: "Email is too long." }, { status: 400 });
  if (reviewer_role && reviewer_role.length > 120)
    return NextResponse.json({ error: "Role is too long." }, { status: 400 });
  if (reviewer_company && reviewer_company.length > 120)
    return NextResponse.json(
      { error: "Company is too long." },
      { status: 400 },
    );
  if (reviewer_linkedin && reviewer_linkedin.length > 200)
    return NextResponse.json(
      { error: "LinkedIn URL is too long." },
      { status: 400 },
    );
  if (!RELATIONSHIPS.includes(relationship))
    return NextResponse.json(
      { error: "Choose how you worked together." },
      { status: 400 },
    );
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return NextResponse.json({ error: "Add a rating." }, { status: 400 });
  if (body.length < 20 || body.length > 600)
    return NextResponse.json(
      { error: "Endorsement must be 20–600 characters." },
      { status: 400 },
    );

  // Earned verification signals.
  const confirm_token = crypto.randomBytes(32).toString("hex");
  const overlap = employerOverlap(reviewer_email, owner);

  try {
    createEndorsement({
      user_id: owner.id,
      reviewer_name,
      reviewer_email,
      reviewer_role,
      reviewer_company,
      reviewer_linkedin,
      relationship,
      rating,
      body,
      strengths,
      email_confirmed: false,
      employer_overlap_verified: overlap,
      linkedin_matched: false,
      confirm_token,
    });
  } catch (err) {
    if (isConstraintError(err)) {
      return NextResponse.json(
        {
          error:
            "You already have an endorsement awaiting review for this profile. Check your email to confirm it.",
        },
        { status: 409 },
      );
    }
    throw err;
  }

  // Send the confirmation email out of the request path: the submission is
  // already persisted, so we don't make the reviewer wait on the email provider
  // (and a delivery failure never loses the submission — the owner still sees it
  // as unconfirmed). Fire-and-forget with logging; an outbox/retry is the next
  // step if delivery guarantees become important.
  const link = `${appBaseUrl(req)}/confirm/${confirm_token}`;
  void sendMail({
    to: reviewer_email,
    subject: `Confirm your endorsement of ${owner.name}`,
    text: `Thanks for vouching for ${owner.name}. Confirm your work email to verify your endorsement:\n\n${link}\n\nIf you didn't write this, you can ignore this email.`,
    html: `<p>Thanks for vouching for <strong>${escapeHtml(owner.name)}</strong>.</p><p>Confirm your work email to verify your endorsement:</p><p><a href="${link}">Confirm my endorsement</a></p><p style="color:#666">If you didn't write this, you can ignore this email.</p>`,
  }).catch((err) => {
    console.error("Confirmation email failed to send:", err);
  });

  return NextResponse.json({ ok: true });
}
