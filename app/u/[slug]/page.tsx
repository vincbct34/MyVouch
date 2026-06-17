import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getUserBySlug,
  getApprovedEndorsements,
  getApprovedStats,
  toPublicEndorsement,
} from "@/lib/db";
import { appBaseUrl } from "@/lib/url";
import { getCurrentUser } from "@/lib/session";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { Avatar } from "@/components/Avatar";
import { ProfileWall } from "@/components/ProfileWall";
import { ShieldIcon, PinIcon, PlusIcon } from "@/components/Icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const owner = getUserBySlug(slug);
  if (!owner) return { title: "Profile not found" };

  const title = `${owner.name} — verified endorsements`;
  const description =
    owner.headline ?? `Verified endorsements for ${owner.name} on Vouch.`;
  const url = `${appBaseUrl()}/u/${owner.slug}`;
  // Sharing the link (LinkedIn/X) is the core flow — give it a rich unfurl.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title,
      description,
      url,
      siteName: "Vouch",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const owner = getUserBySlug(slug);
  if (!owner) notFound();

  const viewer = await getCurrentUser();
  // First page for the wall; aggregate stats computed over ALL approved rows.
  const firstPage = getApprovedEndorsements(owner.id).map(toPublicEndorsement);
  const stats = getApprovedStats(owner.id);

  const total = stats.total;
  // "Verified" means the reviewer confirmed their work email — not just published.
  const verifiedCount = stats.emailVerified;
  const avg = stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—";
  const wouldRehire = stats.recommendPct;

  return (
    <>
      <TopNav user={viewer} />

      <section className="profile-hero">
        <div className="wrap grid">
          <div className="id-block">
            <Avatar name={owner.name} size="xl" />
            <div>
              <h1 className="name">{owner.name}</h1>
              {owner.headline && <div className="role">{owner.headline}</div>}
              {owner.location && (
                <div className="loc">
                  <PinIcon className="ic" /> {owner.location}
                </div>
              )}
              <div className="badges">
                {owner.identity_verified ? (
                  <span className="badge badge-verified">
                    <span className="dot" /> Identity verified
                  </span>
                ) : null}
                {verifiedCount > 0 ? (
                  <span className="badge badge-brand">
                    <span className="dot" /> {verifiedCount} email-verified
                  </span>
                ) : null}
                {owner.open_to_work ? (
                  <span className="badge badge-brand">
                    <span className="dot" /> Open to work
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <div className="stat-strip">
              <div className="stat-box">
                <span className="n">{total}</span>
                <span className="l">Published reviews</span>
              </div>
              <div className="stat-box">
                <span className="n">
                  {avg}
                  {avg !== "—" && "/5"}
                </span>
                <span className="l">Avg rating</span>
              </div>
              <div className="stat-box">
                <span className="n">{wouldRehire}%</span>
                <span className="l">Would recommend</span>
              </div>
            </div>
            <div className="hero-cta">
              <Link href={`/u/${owner.slug}/vouch`} className="btn btn-primary">
                <PlusIcon className="ic" /> Add your endorsement
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap">
        {total === 0 ? (
          <div className="empty-wall">
            <span className="ec">
              <ShieldIcon className="ic" />
            </span>
            <p style={{ marginBottom: 18 }}>
              {owner.name.split(" ")[0]} hasn&rsquo;t published any endorsements
              yet. Be the first to vouch.
            </p>
            <Link href={`/u/${owner.slug}/vouch`} className="btn btn-primary">
              <PlusIcon className="ic" /> Write an endorsement
            </Link>
          </div>
        ) : (
          <ProfileWall slug={owner.slug} initial={firstPage} total={total} />
        )}

        <div className="cta-band">
          <div>
            <h2>Worked with {owner.name.split(" ")[0]}?</h2>
            <p>
              Add a verified endorsement — it takes about two minutes and helps
              their reputation travel.
            </p>
          </div>
          <Link
            href={`/u/${owner.slug}/vouch`}
            className="btn btn-primary btn-lg"
          >
            <PlusIcon className="ic" /> Add your endorsement
          </Link>
        </div>
      </div>

      <Footer />
    </>
  );
}
