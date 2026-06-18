import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { ShieldIcon, CheckIcon, LinkIcon } from "@/components/Icons";

export default async function HomePage() {
  const user = await getCurrentUser();
  const m = getMessages(await getLocale()).landing;

  return (
    <>
      <TopNav user={user} />

      <section className="landing-hero">
        <div className="wrap inner">
          <span className="kicker">{m.kicker}</span>
          <h1>{m.title}</h1>
          <p className="lede">{m.lede}</p>
          <div className="cta-row">
            {user ? (
              <>
                <Link href="/dashboard" className="btn btn-primary btn-lg">
                  {m.goDashboard}
                </Link>
                <Link href={`/u/${user.slug}`} className="btn btn-ghost btn-lg">
                  {m.viewWall}
                </Link>
              </>
            ) : (
              <>
                <Link href="/signup" className="btn btn-primary btn-lg">
                  {m.buildFree}
                </Link>
                <Link href="/login" className="btn btn-ghost btn-lg">
                  {m.logIn}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section id="how" className="wrap">
        <div className="feature-grid">
          <div className="feature card">
            <span className="ficon">
              <LinkIcon />
            </span>
            <h3>{m.f1Title}</h3>
            <p>{m.f1Body}</p>
          </div>
          <div className="feature card" id="trust">
            <span className="ficon">
              <ShieldIcon />
            </span>
            <h3>{m.f2Title}</h3>
            <p>{m.f2Body}</p>
          </div>
          <div className="feature card">
            <span className="ficon">
              <CheckIcon />
            </span>
            <h3>{m.f3Title}</h3>
            <p>{m.f3Body}</p>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
