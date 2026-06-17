import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getEndorsementsForOwner, getAuditLog } from "@/lib/db";
import { appBaseUrl } from "@/lib/url";
import { Brandmark } from "@/components/Brandmark";
import { Avatar } from "@/components/Avatar";
import { ModerationQueue } from "@/components/ModerationQueue";
import { ProfileSettings } from "@/components/ProfileSettings";
import { SecuritySettings } from "@/components/SecuritySettings";
import { AuditLog } from "@/components/AuditLog";
import {
  CopyLink,
  LogoutButton,
  EmailVerifyBanner,
} from "@/components/DashboardChrome";

export const metadata = { title: "Moderation queue" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Owner queue computes its KPIs client-side, so load the full set (capped to a
  // sane bound). The public wall is the unbounded surface and pages separately.
  const endorsements = getEndorsementsForOwner(user.id, { limit: 500 });
  const auditEntries = getAuditLog(user.id);
  const vouchUrl = `${appBaseUrl()}/u/${user.slug}/vouch`;

  return (
    <>
      <header className="admin-head">
        <div className="wrap bar">
          <div className="center">
            <Brandmark onDark href="/dashboard" />
            <span className="badge">Admin</span>
          </div>
          <div className="center">
            <Link href={`/u/${user.slug}`} className="btn btn-ghost btn-sm">
              View public profile
            </Link>
            <LogoutButton />
            <Avatar name={user.name} size="sm" />
          </div>
        </div>
      </header>

      {!user.email_confirmed && <EmailVerifyBanner />}

      <div className="wrap share-row">
        <CopyLink url={vouchUrl} />
        <ProfileSettings
          headline={user.headline}
          location={user.location}
          linkedinUrl={user.linkedin_url}
          openToWork={!!user.open_to_work}
        />
        <SecuritySettings />
        <AuditLog entries={auditEntries} />
      </div>

      <ModerationQueue initial={endorsements} />
    </>
  );
}
