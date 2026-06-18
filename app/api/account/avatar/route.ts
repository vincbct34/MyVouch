import { NextResponse } from "next/server";
import { apiMessages } from "@/lib/apimsg";
import { setAvatar, clearAvatar } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { rateLimitAll, clientIp } from "@/lib/ratelimit";
import { isSameOrigin } from "@/lib/http";

/** Image types we accept for a profile photo. */
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Hard cap on stored bytes. The client downscales first, so this is a backstop. */
const MAX_BYTES = 700 * 1024;

/**
 * Upload (or replace) the owner's profile photo. The raw image is sent as the
 * request body with its Content-Type set to the image MIME — no multipart
 * parsing needed. Bytes are stored in the user_avatars table.
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
    { key: `avatar:user:${user.id}`, limit: 20, windowMs: 15 * 60_000 },
    { key: `avatar:ip:${clientIp(req)}`, limit: 60, windowMs: 15 * 60_000 },
  ]);
  if (!limited.ok)
    return NextResponse.json(
      { error: apiMessages(req).api.tooManyAttempts },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!ALLOWED_MIME.has(mime))
    return NextResponse.json(
      { error: apiMessages(req).api.avatarType },
      { status: 400 },
    );

  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0)
    return NextResponse.json(
      { error: apiMessages(req).api.invalidRequest },
      { status: 400 },
    );
  if (bytes.length > MAX_BYTES)
    return NextResponse.json(
      { error: apiMessages(req).api.avatarTooLarge },
      { status: 400 },
    );

  setAvatar(user.id, bytes, mime);
  return NextResponse.json({ ok: true });
}

/** Remove the owner's profile photo, reverting to generated initials. */
export async function DELETE(req: Request) {
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

  clearAvatar(user.id);
  return NextResponse.json({ ok: true });
}
