import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getAuditLog, listApiTokens } from "@/lib/db";
import { avatarUrl } from "@/lib/ui";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";
import {
  DashboardHeader,
  EmailVerifyBanner,
} from "@/components/DashboardChrome";
import { AccountPanels } from "@/components/AccountPanels";
import { ApiTokens } from "@/components/ApiTokens";
import { AuditLog } from "@/components/AuditLog";
import { DangerZone } from "@/components/DangerZone";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getMessages(await getLocale()).account.metaTitle,
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await getLocale();
  const m = getMessages(locale).account;
  const auditEntries = getAuditLog(user.id);
  const apiTokens = listApiTokens(user.id);

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

      <main className="account-main">
        <div className="wrap account-wrap">
          <div className="account-head">
            <h1>{m.title}</h1>
            <p className="sub">{m.subtitle}</p>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">
              {m.back}
            </Link>
          </div>

          <AccountPanels
            initial={{
              slug: user.slug,
              name: user.name,
              email: user.email,
              emailConfirmed: !!user.email_confirmed,
              headline: user.headline,
              location: user.location,
              linkedinUrl: user.linkedin_url,
              openToWork: !!user.open_to_work,
              avatarUrl: avatarUrl(user.slug, user.avatar_updated_at),
            }}
          />

          <ApiTokens
            initial={apiTokens.map((t) => ({
              id: t.id,
              name: t.name,
              last_used_at: t.last_used_at,
              created_at: t.created_at,
            }))}
          />

          <section className="account-card">
            <h2>{m.activityTitle}</h2>
            <AuditLog entries={auditEntries} locale={locale} />
          </section>

          <DangerZone slug={user.slug} />
        </div>
      </main>
    </>
  );
}
