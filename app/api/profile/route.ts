import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { updateProfile } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";

/** Owner edits their own editable profile fields (#12). */
export async function PATCH(req: Request) {
  if (!isSameOrigin(req))
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });

  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const headline = String(body.headline ?? "").trim() || null;
  const location = String(body.location ?? "").trim() || null;
  const linkedin_url = String(body.linkedin_url ?? "").trim() || null;
  const open_to_work = body.open_to_work ? 1 : 0;

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
  if (linkedin_url && linkedin_url.length > 200)
    return NextResponse.json(
      { error: "LinkedIn URL is too long." },
      { status: 400 },
    );
  if (linkedin_url && !/^https?:\/\//i.test(linkedin_url))
    return NextResponse.json(
      { error: "LinkedIn URL must start with http(s)://." },
      { status: 400 },
    );

  updateProfile(user.id, { headline, location, linkedin_url, open_to_work });
  return NextResponse.json({ ok: true });
}
