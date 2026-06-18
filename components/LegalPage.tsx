import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";
import { TopNav } from "./TopNav";

type LegalKey = "legalNotice" | "privacy" | "terms";

/** Shared scaffold for the static legal pages (legal notice, privacy, terms). */
export async function LegalPage({ which }: { which: LegalKey }) {
  const user = await getCurrentUser();
  const m = getMessages(await getLocale()).legal;
  const page = m[which];
  return (
    <>
      <TopNav user={user} />
      <main className="legal-main wrap">
        <article className="legal-doc">
          <h1>{page.title}</h1>
          <p className="legal-updated">{m.updated}</p>
          {page.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              <p>{s.p}</p>
            </section>
          ))}
          <Link href="/" className="legal-back">
            ← {m.backHome}
          </Link>
        </article>
      </main>
    </>
  );
}
