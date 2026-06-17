import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { bumpSessionEpoch, appendAuditLog } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";

/**
 * Log out of every device: bump the session epoch (revoking all tokens for the
 * user, including this one) and clear the current cookie. The client should
 * redirect to /login afterward.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  bumpSessionEpoch(user.id);
  appendAuditLog(user.id, "session.logout_all");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
