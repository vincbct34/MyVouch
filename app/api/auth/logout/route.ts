import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { bumpSessionEpoch } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";

export async function POST(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  // Bump the epoch so the just-cleared token (and any other copies) can't be
  // replayed even if it was captured before logout.
  const user = await getCurrentUser();
  if (user) bumpSessionEpoch(user.id);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
