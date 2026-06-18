import Link from "next/link";
import { Brandmark } from "@/components/Brandmark";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";

export default async function NotFound() {
  const m = getMessages(await getLocale()).notFound;
  return (
    <main className="auth-wrap">
      <div
        className="auth-card"
        style={{ textAlign: "center", alignItems: "center" }}
      >
        <Brandmark size="lg" />
        <h1>{m.title}</h1>
        <p className="sub" style={{ marginTop: 0 }}>
          {m.sub}
        </p>
        <Link href="/" className="btn btn-primary">
          {m.back}
        </Link>
      </div>
    </main>
  );
}
