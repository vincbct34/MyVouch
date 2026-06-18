import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { apiMessages } from "@/lib/apimsg";
import {
  deleteEndorsement,
  updateEndorsementBody,
  appendAuditLog,
} from "@/lib/db";
import { isSameOrigin } from "@/lib/http";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) ? n : null;
}

/** Owner edits the body text of one of their endorsements (typo/trim fixes). */
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
  const endorsementId = parseId(id);
  if (endorsementId === null)
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

  const text = String(body.body ?? "").trim();
  if (text.length < 20 || text.length > 600)
    return NextResponse.json(
      { error: apiMessages(req).api.endorsement20to600 },
      { status: 400 },
    );

  // Scoped to this owner's rows only.
  const ok = updateEndorsementBody(endorsementId, user.id, text);
  if (!ok)
    return NextResponse.json(
      { error: apiMessages(req).api.endorsementNotFound },
      { status: 404 },
    );

  appendAuditLog(user.id, "endorsement.edit", `id=${endorsementId}`);
  return NextResponse.json({ ok: true });
}

/** Owner permanently removes one of their endorsements. */
export async function DELETE(
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
  const endorsementId = parseId(id);
  if (endorsementId === null)
    return NextResponse.json(
      { error: apiMessages(req).api.invalidId },
      { status: 400 },
    );

  const ok = deleteEndorsement(endorsementId, user.id);
  if (!ok)
    return NextResponse.json(
      { error: apiMessages(req).api.endorsementNotFound },
      { status: 404 },
    );

  appendAuditLog(user.id, "endorsement.delete", `id=${endorsementId}`);
  return NextResponse.json({ ok: true });
}
