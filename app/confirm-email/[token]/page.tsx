import type { Metadata } from "next";
import { EmailConfirmAction } from "@/components/EmailConfirmAction";
import { Brandmark } from "@/components/Brandmark";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).confirmEmailMeta };
}

export default async function ConfirmEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Brandmark size="lg" />
        <EmailConfirmAction token={token} />
      </div>
    </main>
  );
}
