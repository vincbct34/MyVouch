import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUserBySlug } from "@/lib/db";
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
  return { title: owner ? `MyVouch for ${owner.name}` : "Submit endorsement" };
}

export default async function VouchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const owner = getUserBySlug(slug);
  if (!owner) notFound();

  return (
    <>
      <header className="topnav">
        <div className="wrap bar">
          <Brandmark />
          <Link href={`/u/${owner.slug}`} className="btn btn-ghost btn-sm">
            View wall
          </Link>
        </div>
      </header>

      <main className="submit-main">
        <div className="submit-intro">
          <span className="for-pill">
            You&rsquo;re vouching for {owner.name}
            <Avatar name={owner.name} size="sm" />
          </span>
          <h1>You&rsquo;re vouching for {owner.name.split(" ")[0]}</h1>
          <p className="copy">
            A good endorsement is specific and honest.{" "}
            {owner.name.split(" ")[0]} reviews every submission before anything
            goes public.
          </p>
        </div>

        <SubmitForm ownerName={owner.name} ownerSlug={owner.slug} />
      </main>
    </>
  );
}
