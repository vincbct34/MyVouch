import { ImageResponse } from "next/og";
import { getUserBySlug, getApprovedStats } from "@/lib/db";

// Dynamic social-share image for /u/[slug]. Next wires this as the OG/Twitter
// image automatically. Runs on the Node runtime (better-sqlite3 isn't edge-safe).
export const runtime = "nodejs";
export const alt = "Verified endorsements on MyVouch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens are oklch in CSS; satori needs plain colors, so use hex approximations.
const BRAND = "#3a52d6";
const BRAND_DEEP = "#2b3aa0";
const INK = "#1c2230";
const PAPER = "#fbfbfd";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const owner = getUserBySlug(slug);
  const stats = owner ? getApprovedStats(owner.id) : null;
  const name = owner?.name ?? "MyVouch";
  const headline = owner?.headline ?? "Verified endorsements";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: PAPER,
        padding: "72px 80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", color: BRAND_DEEP }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: BRAND,
            marginRight: 18,
          }}
        />
        <div style={{ fontSize: 34, fontWeight: 700 }}>MyVouch</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: INK,
            lineHeight: 1.05,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 34, color: "#52607a", marginTop: 16 }}>
          {headline}
        </div>
      </div>

      <div style={{ display: "flex", gap: 56, color: INK }}>
        <Stat n={String(stats?.total ?? 0)} l="Endorsements" />
        <Stat
          n={stats?.avgRating != null ? `${stats.avgRating.toFixed(1)}/5` : "—"}
          l="Avg rating"
        />
        <Stat n={String(stats?.emailVerified ?? 0)} l="Email-verified" />
      </div>
    </div>,
    size,
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 52, fontWeight: 800 }}>{n}</div>
      <div style={{ fontSize: 26, color: "#52607a" }}>{l}</div>
    </div>
  );
}
