import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getUserBySlug,
  getApprovedEndorsements,
  getApprovedStats,
  toPublicEndorsement,
  encodeCursor,
  PAGE_SIZE,
} from "@/lib/db";
import { appBaseUrl, localeAlternates } from "@/lib/url";
import { getCurrentUser } from "@/lib/session";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";
import { avatarUrl } from "@/lib/ui";
import { TopNav } from "@/components/TopNav";
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
  const locale = await getLocale();
  const m = getMessages(locale).profile;
  if (!owner) return { title: m.metaNotFound, robots: { index: false } };

  const title = m.metaTitle(owner.name);
  const description = owner.headline ?? m.metaDesc(owner.name);
  const alternates = localeAlternates(`/u/${owner.slug}`, locale);
  // Sharing the link (LinkedIn/X) is the core flow — give it a rich unfurl.
  return {
    title,
    description,
    alternates,
    openGraph: {
      type: "profile",
      title,
      description,
      url: alternates.canonical,
      siteName: "MyVouch",
      locale: locale === "fr" ? "fr_FR" : "en_US",
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
  const locale = await getLocale();
  const m = getMessages(locale).profile;
  // First page for the wall; aggregate stats computed over ALL approved rows.
  const firstRows = getApprovedEndorsements(owner.id);
  const firstPage = firstRows.map(toPublicEndorsement);
  // Keyset cursor handed to the client only when a full page came back.
  const initialCursor =
    firstRows.length === PAGE_SIZE
      ? encodeCursor(firstRows[firstRows.length - 1])
      : null;
  const stats = getApprovedStats(owner.id);

  const total = stats.total;
  // "Verified" means the reviewer confirmed their work email — not just published.
  const verifiedCount = stats.emailVerified;
  const avg = stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—";
  const wouldRehire = stats.recommendPct;

  // Person + AggregateRating structured data so search engines can show review
  // rich results. AggregateRating is included only when there's a real rating to
  // report — empty/zero ratings are dropped rather than faked.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: owner.name,
    url: `${appBaseUrl()}/${locale}/u/${owner.slug}`,
    ...(owner.headline ? { jobTitle: owner.headline } : {}),
    ...(owner.location
      ? { homeLocation: { "@type": "Place", name: owner.location } }
      : {}),
    ...(total > 0 && stats.avgRating !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: stats.avgRating.toFixed(1),
            reviewCount: total,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TopNav user={viewer} />

      <section className="profile-hero">
        <div className="wrap grid">
          <div className="id-block">
            <Avatar
              name={owner.name}
              size="xl"
              src={avatarUrl(owner.slug, owner.avatar_updated_at)}
            />
            <div>
              <h1 className="name">{owner.name}</h1>
              {owner.headline && <div className="role">{owner.headline}</div>}
              {owner.location && (
                <div className="loc">
                  <PinIcon className="ic" /> {owner.location}
                </div>
              )}
              <div className="badges">
                {verifiedCount > 0 ? (
                  <span className="badge badge-brand">
                    <span className="dot" />{" "}
                    {m.badgeEmailVerified(verifiedCount)}
                  </span>
                ) : null}
                {owner.open_to_work ? (
                  <span className="badge badge-brand">
                    <span className="dot" /> {m.openToWork}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <div className="stat-strip">
              <div className="stat-box">
                <span className="n">{total}</span>
                <span className="l">{m.statPublished}</span>
              </div>
              <div className="stat-box">
                <span className="n">
                  {avg}
                  {avg !== "—" && "/5"}
                </span>
                <span className="l">{m.statAvg}</span>
              </div>
              <div className="stat-box">
                <span className="n">{wouldRehire}%</span>
                <span className="l">{m.statRecommend}</span>
              </div>
            </div>
            <div className="hero-cta">
              <Link href={`/u/${owner.slug}/vouch`} className="btn btn-primary">
                <PlusIcon className="ic" /> {m.addEndorsement}
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
              {m.emptyWall(owner.name.split(" ")[0])}
            </p>
            <Link href={`/u/${owner.slug}/vouch`} className="btn btn-primary">
              <PlusIcon className="ic" /> {m.writeEndorsement}
            </Link>
          </div>
        ) : (
          <ProfileWall
            slug={owner.slug}
            initial={firstPage}
            initialCursor={initialCursor}
            total={total}
          />
        )}

        <div className="cta-band">
          <div>
            <h2>{m.ctaTitle(owner.name.split(" ")[0])}</h2>
            <p>{m.ctaBody}</p>
          </div>
          <Link
            href={`/u/${owner.slug}/vouch`}
            className="btn btn-primary btn-lg"
          >
            <PlusIcon className="ic" /> {m.addEndorsement}
          </Link>
        </div>
      </div>
    </>
  );
}
