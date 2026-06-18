import Link from "next/link";
import { Brandmark } from "./Brandmark";
import { Avatar } from "./Avatar";
import type { User } from "@/lib/db";
import { avatarUrl } from "@/lib/ui";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";

/** Public-facing sticky top nav. Auth-aware action on the right. */
export async function TopNav({ user }: { user: User | null }) {
  const m = getMessages(await getLocale()).nav;
  return (
    <header className="topnav">
      <div className="wrap bar">
        <Brandmark />
        <div className="center">
          {user ? (
            <Link href="/dashboard" aria-label={m.dashboardAria}>
              <Avatar
                name={user.name}
                size="sm"
                src={avatarUrl(user.slug, user.avatar_updated_at)}
              />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                {m.logIn}
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                {m.getWall}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
