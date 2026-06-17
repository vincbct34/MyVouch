import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { ShieldIcon, CheckIcon, LinkIcon } from "@/components/Icons";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <>
      <TopNav user={user} active="home" />

      <section className="landing-hero">
        <div className="wrap inner">
          <span className="kicker">Verified endorsements</span>
          <h1>References people actually trust.</h1>
          <p className="lede">
            MyVouch turns scattered word-of-mouth into a verified wall of
            endorsements you own. Every reference is checked for a real work
            email, a shared employer, and a matched identity — so your
            reputation speaks for itself.
          </p>
          <div className="cta-row">
            {user ? (
              <>
                <Link href="/dashboard" className="btn btn-primary btn-lg">
                  Go to your dashboard
                </Link>
                <Link href={`/u/${user.slug}`} className="btn btn-ghost btn-lg">
                  View your wall
                </Link>
              </>
            ) : (
              <>
                <Link href="/signup" className="btn btn-primary btn-lg">
                  Build your wall — free
                </Link>
                <Link href="/login" className="btn btn-ghost btn-lg">
                  Log in
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
            <h3>Share one link</h3>
            <p>
              Send your personal MyVouch link to managers, peers, and clients. A
              guided form makes leaving a thoughtful endorsement take two
              minutes.
            </p>
          </div>
          <div className="feature card" id="trust">
            <span className="ficon">
              <ShieldIcon />
            </span>
            <h3>Verified, not vibes</h3>
            <p>
              Each endorsement carries verification signals — work email
              confirmed, employer overlap, identity matched — so readers know
              it&rsquo;s real.
            </p>
          </div>
          <div className="feature card">
            <span className="ficon">
              <CheckIcon />
            </span>
            <h3>You stay in control</h3>
            <p>
              Nothing goes public until you approve it. Moderate your queue,
              request edits, or decline — your wall, your call.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
