import { EmailConfirmAction } from "@/components/EmailConfirmAction";
import { Brandmark } from "@/components/Brandmark";

export const metadata = { title: "Confirm your email" };

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
