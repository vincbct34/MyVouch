import { ConfirmAction } from "@/components/ConfirmAction";
import { Brandmark } from "@/components/Brandmark";

export const metadata = { title: "Confirm your endorsement" };

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
