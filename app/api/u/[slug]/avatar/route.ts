import { getAvatarBytesBySlug } from "@/lib/db";

/**
 * Public, read-only profile photo for an owner's wall. Bytes live in the
 * user_avatars table; the wall and chrome point an <img> at this URL with a
 * `?v=avatar_updated_at` cache-buster. 404 when the owner has no photo (callers
 * fall back to generated initials).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const row = getAvatarBytesBySlug(slug);
  if (!row) return new Response(null, { status: 404 });

  // Immutable: the URL is versioned by avatar_updated_at, so any change yields a
  // new URL. Safe to cache hard.
  return new Response(new Uint8Array(row.bytes), {
    status: 200,
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
