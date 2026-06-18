import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUserBySlug } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";
import { Brandmark } from "@/components/Brandmark";
import { Avatar } from "@/components/Avatar";
import { SubmitForm } from "@/components/SubmitForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const owner = getUserBySlug(slug);
  const m = getMessages(await getLocale()).vouch;
  return { title: owner ? m.metaTitle(owner.name) : m.metaTitleNone };
}

export default async function VouchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const owner = getUserBySlug(slug);
  if (!owner) notFound();
  const m = getMessages(await getLocale()).vouch;

  return (
    <>
      <header className="topnav">
        <div className="wrap bar">
          <Brandmark />
          <Link href={`/u/${owner.slug}`} className="btn btn-ghost btn-sm">
            {m.viewWall}
          </Link>
        </div>
      </header>

      <main className="submit-main">
        <div className="submit-intro">
          <span className="for-pill">
            {m.forPill(owner.name)}
            <Avatar name={owner.name} size="sm" />
          </span>
          <h1>{m.title(owner.name.split(" ")[0])}</h1>
          <p className="copy">{m.copy(owner.name.split(" ")[0])}</p>
        </div>

        <SubmitForm ownerName={owner.name} ownerSlug={owner.slug} />
      </main>
    </>
  );
}
