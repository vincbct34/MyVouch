import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { apiMessages } from "@/lib/apimsg";
import { moderateEndorsement, appendAuditLog, type Status } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";

// Owners approve or decline; "pending" is the initial state, not a manual target.
const VALID: Status[] = ["approved", "declined"];

export async function POST(
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

  const status = String(body.status ?? "") as Status;
  if (!VALID.includes(status))
    return NextResponse.json(
      { error: apiMessages(req).api.invalidStatus },
      { status: 400 },
    );

  // moderateEndorsement scopes the update to this owner's rows only.
  const ok = moderateEndorsement(endorsementId, user.id, status);
  if (!ok)
    return NextResponse.json(
      { error: apiMessages(req).api.endorsementNotFound },
      { status: 404 },
    );

  appendAuditLog(user.id, `endorsement.${status}`, `id=${endorsementId}`);
  return NextResponse.json({ ok: true });
}
