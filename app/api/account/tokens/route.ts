import { NextResponse } from "next/server";
import { apiMessages } from "@/lib/apimsg";
import {
  createApiToken,
  listApiTokens,
  countApiTokens,
  appendAuditLog,
} from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { generateApiToken, hashApiToken } from "@/lib/auth";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";

/** A user can hold at most this many active tokens at once. */
const MAX_TOKENS = 10;

/** List the signed-in owner's API tokens (metadata only — never the secret). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json(
      { error: apiMessages(req).api.notAuthenticated },
      { status: 401 },
    );
  return NextResponse.json({ tokens: listApiTokens(user.id) });
}

/**
 * Mint a new API token for the signed-in owner. Cookie-session guarded (this is
 * the bootstrap that issues Bearer credentials, so it must NOT itself accept a
 * Bearer token). Returns the raw token exactly once — only its hash is stored.
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
    { key: `token:user:${user.id}`, limit: 10, windowMs: 15 * 60_000 },
    { key: `token:ip:${clientIp(req)}`, limit: 50, windowMs: 15 * 60_000 },
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

  const name =
    String(body.name ?? "").trim() || apiMessages(req).api.tokenDefaultName;
  if (name.length > 60)
    return NextResponse.json(
      { error: apiMessages(req).api.tokenNameLong },
      { status: 400 },
    );
  if (countApiTokens(user.id) >= MAX_TOKENS)
    return NextResponse.json(
      { error: apiMessages(req).api.tooManyTokens },
      { status: 409 },
    );

  const raw = generateApiToken();
  const id = createApiToken(user.id, name, hashApiToken(raw));
  appendAuditLog(user.id, "token.create", name);

  // The raw token is returned this once and never again; we only persist its hash.
  return NextResponse.json({ id, name, token: raw }, { status: 201 });
}
