import { notFound } from "next/navigation";
import { getEndorsementByManageToken } from "@/lib/db";
import { Brandmark } from "@/components/Brandmark";
import { ManageAction } from "@/components/ManageAction";

export const metadata = { title: "Manage your endorsement" };

export default async function ManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const view = getEndorsementByManageToken(token);
  if (!view) notFound();

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Brandmark size="lg" />
        <ManageAction
          token={token}
          reviewerName={view.reviewer_name}
          ownerName={view.owner_name}
          ownerSlug={view.owner_slug}
        />
      </div>
    </main>
  );
}
