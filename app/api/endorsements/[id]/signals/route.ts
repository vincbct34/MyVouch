import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { apiMessages } from "@/lib/apimsg";
import { setLinkedInMatched } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";

/** Owner toggles the manual LinkedIn-match verification signal (#2c). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const endorsementId = Number(id);
  if (!Number.isInteger(endorsementId))
    return NextResponse.json(
      { error: apiMessages(req).api.invalidId },
      { status: 400 },
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

  if (typeof body.linkedin_matched !== "boolean")
    return NextResponse.json(
      { error: apiMessages(req).api.linkedinBool },
      { status: 400 },
    );

  const ok = setLinkedInMatched(endorsementId, user.id, body.linkedin_matched);
  if (!ok)
    return NextResponse.json(
      { error: apiMessages(req).api.endorsementNotFound },
      { status: 404 },
    );

  return NextResponse.json({ ok: true });
}
