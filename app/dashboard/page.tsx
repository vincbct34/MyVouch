import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getEndorsementsForOwner } from "@/lib/db";
import { appBaseUrl } from "@/lib/url";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";
import { DashboardHeader } from "@/components/DashboardChrome";
import { ModerationQueue } from "@/components/ModerationQueue";
import { CopyLink, EmailVerifyBanner } from "@/components/DashboardChrome";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).dashboard.metaTitle };
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Owner queue computes its KPIs client-side, so load the full set (capped to a
  // sane bound). The public wall is the unbounded surface and pages separately.
  const endorsements = getEndorsementsForOwner(user.id, { limit: 500 });
  const vouchUrl = `${appBaseUrl()}/u/${user.slug}/vouch`;

  return (
    <>
      <DashboardHeader
        user={{
          slug: user.slug,
          name: user.name,
          avatarUpdatedAt: user.avatar_updated_at,
        }}
      />

      {!user.email_confirmed && <EmailVerifyBanner />}

      <div className="wrap share-row">
        <CopyLink url={vouchUrl} />
      </div>

      <ModerationQueue initial={endorsements} />
    </>
  );
}
