import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { apiMessages } from "@/lib/apimsg";
import {
  getUserBySlug,
  createEndorsement,
  getApprovedEndorsements,
  countApprovedEndorsements,
  toPublicEndorsement,
  decodeCursor,
  encodeCursor,
  PAGE_SIZE,
  type Relationship,
} from "@/lib/db";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin, isLikelyBot } from "@/lib/http";
import { employerOverlap } from "@/lib/verify";
import { enqueueMail } from "@/lib/outbox";
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
    return NextResponse.json(
      { error: apiMessages(req).api.profileNotFound },
      { status: 404 },
    );

  const url = new URL(req.url);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const rows = getApprovedEndorsements(owner.id, { limit: PAGE_SIZE, cursor });
  // Keyset cursor for the *next* page: the last row of this one. Null when the
  // page came back short, signalling the client there's nothing more to load.
  const nextCursor =
    rows.length === PAGE_SIZE ? encodeCursor(rows[rows.length - 1]) : null;

  return NextResponse.json({
    endorsements: rows.map(toPublicEndorsement),
    nextCursor,
    total: countApprovedEndorsements(owner.id),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isSameOrigin(req))
    return NextResponse.json(
      { error: apiMessages(req).api.invalidRequest },
      { status: 403 },
    );

  const { slug } = await params;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json(
      { error: apiMessages(req).api.invalidRequest },
      { status: 400 },
    );
  }

  // Bot defense (honeypot + timing). Respond 200-ok so bots get no signal to
  // tune against, but never persist. Checked before any expensive work.
  if (isLikelyBot({ honeypot: b.company_url, elapsedMs: b.elapsed_ms })) {
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
      { error: apiMessages(req).api.tooManySubmissions },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const owner = getUserBySlug(slug);
  if (!owner)
    return NextResponse.json(
      { error: apiMessages(req).api.profileNotFound },
      { status: 404 },
    );

  if (reviewer_name.length < 2)
    return NextResponse.json(
      { error: apiMessages(req).api.enterName },
      { status: 400 },
    );
  if (reviewer_name.length > 120)
    return NextResponse.json(
      { error: apiMessages(req).api.nameLong },
      { status: 400 },
    );
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reviewer_email))
    return NextResponse.json(
      { error: apiMessages(req).api.enterEmail },
      { status: 400 },
    );
  if (reviewer_email.length > 254)
    return NextResponse.json(
      { error: apiMessages(req).api.emailLong },
      { status: 400 },
    );
  if (reviewer_role && reviewer_role.length > 120)
    return NextResponse.json(
      { error: apiMessages(req).api.roleLong },
      { status: 400 },
    );
  if (reviewer_company && reviewer_company.length > 120)
    return NextResponse.json(
      { error: apiMessages(req).api.companyLong },
      { status: 400 },
    );
  if (reviewer_linkedin && reviewer_linkedin.length > 200)
    return NextResponse.json(
      { error: apiMessages(req).api.linkedinLong },
      { status: 400 },
    );
  if (!RELATIONSHIPS.includes(relationship))
    return NextResponse.json(
      { error: apiMessages(req).api.chooseRelationship },
      { status: 400 },
    );
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return NextResponse.json(
      { error: apiMessages(req).api.addRating },
      { status: 400 },
    );
  if (body.length < 20 || body.length > 600)
    return NextResponse.json(
      { error: apiMessages(req).api.endorsement20to600 },
      { status: 400 },
    );

  // Earned verification signals.
  const confirm_token = crypto.randomBytes(32).toString("hex");
  // Stable secret backing the reviewer's /manage/[token] withdraw page. Never
  // rotated or cleared (unlike confirm_token), so the link in the email keeps
  // working after confirmation if the reviewer later changes their mind.
  const manage_token = crypto.randomBytes(32).toString("hex");
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
      manage_token,
    });
  } catch (err) {
    if (isConstraintError(err)) {
      return NextResponse.json(
        {
          error: apiMessages(req).api.duplicatePending,
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
  const base = appBaseUrl(req);
  const link = `${base}/confirm/${confirm_token}`;
  const manageLink = `${base}/manage/${manage_token}`;
  enqueueMail({
    to: reviewer_email,
    subject: apiMessages(req).email.confirmEndorsementSubject(owner.name),
    text: apiMessages(req).email.confirmEndorsementText(
      owner.name,
      link,
      manageLink,
    ),
    html: apiMessages(req).email.confirmEndorsementHtml(
      escapeHtml(owner.name),
      link,
      manageLink,
    ),
  });

  return NextResponse.json({ ok: true });
}
