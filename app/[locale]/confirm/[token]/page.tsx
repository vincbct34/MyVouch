import type { Metadata } from "next";
import { ConfirmAction } from "@/components/ConfirmAction";
import { Brandmark } from "@/components/Brandmark";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).confirmMeta };
}

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Brandmark size="lg" />
        <ConfirmAction token={token} />
      </div>
    </main>
  );
}
