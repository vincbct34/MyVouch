import { NextResponse } from "next/server";
import { confirmEndorsementEmail } from "@/lib/db";
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

  const token = String(body.token ?? "").trim();
  if (!/^[a-f0-9]{64}$/.test(token))
    return NextResponse.json({ error: "Invalid link." }, { status: 400 });

  // Throttle retries on a single link AND attempts per IP. Keying on the token
  // (not just IP) means distinct confirmations never share a bucket, so a busy
  // site can't globally throttle legitimate confirmations when TRUST_PROXY is
  // unset. Tokens are 256-bit random; the IP cap is generous abuse protection.
  const limited = rateLimitAll([
    {
      key: `confirm:token:${token.slice(0, 16)}`,
      limit: 10,
      windowMs: 10 * 60_000,
    },
    { key: `confirm:ip:${clientIp(req)}`, limit: 100, windowMs: 10 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const { result, slug } = confirmEndorsementEmail(token);
  if (result === "expired")
    return NextResponse.json(
      {
        error: "This confirmation link has expired.",
        expired: true,
        slug,
      },
      { status: 410 },
    );
  if (result === "invalid")
    return NextResponse.json(
      { error: "This link is invalid or has already been used." },
      { status: 404 },
    );

  return NextResponse.json({ ok: true, slug });
}
