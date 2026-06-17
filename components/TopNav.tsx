import Link from "next/link";
import { Brandmark } from "./Brandmark";
import { Avatar } from "./Avatar";
import type { User } from "@/lib/db";

/** Public-facing sticky top nav. Auth-aware action on the right. */
export function TopNav({
  user,
  active,
}: {
  user: User | null;
  active?: "home" | "dashboard";
}) {
  return (
    <header className="topnav">
      <div className="wrap bar">
        <Brandmark />
        <nav className="primary">
          <Link href="/#how">How it works</Link>
          <Link href="/#trust">Verification</Link>
          {user && (
            <Link
              href="/dashboard"
              className={active === "dashboard" ? "active" : ""}
            >
              Dashboard
            </Link>
          )}
        </nav>
        <div className="center">
          {user ? (
            <Link href="/dashboard" aria-label="Your dashboard">
              <Avatar name={user.name} size="sm" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                Get your wall
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
