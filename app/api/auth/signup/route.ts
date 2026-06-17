import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  createUser,
  getUserByEmail,
  slugExists,
  setEmailConfirmToken,
} from "@/lib/db";
import {
  hashPassword,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { slugify } from "@/lib/ui";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";
import { enqueueMail } from "@/lib/outbox";
import { appBaseUrl } from "@/lib/url";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();

  // Throttle account creation: per email AND per IP, so one IP can't exhaust a
  // global bucket and block everyone from signing up.
  const limited = rateLimitAll([
    { key: `signup:email:${email}`, limit: 3, windowMs: 60 * 60_000 },
    { key: `signup:ip:${clientIp(req)}`, limit: 20, windowMs: 60 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many signups. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  const password = String(body.password ?? "");
  const headline = String(body.headline ?? "").trim() || null;
  const location = String(body.location ?? "").trim() || null;

  if (name.length < 2)
    return NextResponse.json(
      { error: "Please enter your name." },
      { status: 400 },
    );
  if (name.length > 120)
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400 },
    );
  if (email.length > 254)
    return NextResponse.json({ error: "Email is too long." }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  if (password.length > 256)
    return NextResponse.json(
      { error: "Password must be 256 characters or fewer." },
      { status: 400 },
    );
  if (headline && headline.length > 160)
    return NextResponse.json(
      { error: "Headline is too long." },
      { status: 400 },
    );
  if (location && location.length > 120)
    return NextResponse.json(
      { error: "Location is too long." },
      { status: 400 },
    );

  if (getUserByEmail(email))
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );

  // Unique slug from name.
  const base = slugify(name) || "user";
  let slug = base;
  let n = 1;
  while (slugExists(slug)) slug = `${base}-${++n}`;

  const id = createUser({
    name,
    email,
    password_hash: hashPassword(password),
    slug,
    headline,
    location,
  });

  // Owner email starts unverified. Mint a confirm token and mail the link; the
  // employer-overlap signal is only credited once the owner confirms their own
  // email (see lib/verify.ts), so this gates the strongest verification badge.
  const emailToken = crypto.randomBytes(32).toString("hex");
  setEmailConfirmToken(id, emailToken);
  const link = `${appBaseUrl(req)}/confirm-email/${emailToken}`;
  enqueueMail({
    to: email,
    subject: "Confirm your email for MyVouch",
    text: `Welcome to MyVouch. Confirm your email to unlock verified endorsement signals:\n\n${link}\n`,
    html: `<p>Welcome to MyVouch.</p><p>Confirm your email to unlock verified endorsement signals:</p><p><a href="${link}">Confirm my email</a></p>`,
  });

  const res = NextResponse.json({ ok: true, slug });
  // New accounts start at session_epoch 0.
  res.cookies.set(
    SESSION_COOKIE,
    createSessionToken(id, 0),
    sessionCookieOptions,
  );
  return res;
}
