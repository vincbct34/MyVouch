import { NextResponse } from "next/server";
import { apiMessages } from "@/lib/apimsg";
import { revokeApiToken, appendAuditLog } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isSameOrigin } from "@/lib/http";

/** Revoke (hard-delete) one of the signed-in owner's API tokens. */
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
  const tokenId = Number(id);
  if (!Number.isInteger(tokenId))
    return NextResponse.json(
      { error: apiMessages(req).api.invalidId },
      { status: 400 },
    );

  if (!revokeApiToken(tokenId, user.id))
    return NextResponse.json(
      { error: apiMessages(req).api.tokenNotFound },
      { status: 404 },
    );

  appendAuditLog(user.id, "token.revoke", String(tokenId));
  return NextResponse.json({ ok: true });
}
