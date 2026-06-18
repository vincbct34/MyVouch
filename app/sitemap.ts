import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/url";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n";
import { listProfileSlugs } from "@/lib/db";

// Public, crawlable surface. Every page is locale-prefixed (/en, /fr), so each
// path is emitted once per locale with hreflang alternates linking the set (plus
// x-default → DEFAULT_LOCALE). lastmod on profiles tracks the wall's newest
// approved endorsement. Owner-only, auth, and token routes are absent.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appBaseUrl();
  const now = new Date();

  // Build the hreflang alternates map for a locale-independent path tail.
  const alternates = (tail: string) => ({
    languages: {
      ...Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${tail}`])),
      "x-default": `${base}/${DEFAULT_LOCALE}${tail}`,
    },
  });

  // Emit one entry per locale for a path, each carrying the full alternates set.
  const localized = (
    tail: string,
    lastModified: Date,
    changeFrequency: "weekly" | "daily" | "monthly",
    priority: number,
  ): MetadataRoute.Sitemap =>
    LOCALES.map((l) => ({
      url: `${base}/${l}${tail}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: alternates(tail),
    }));

  const staticRoutes = localized("", now, "weekly", 1);

  const profiles = listProfileSlugs().flatMap(({ slug, last }) => {
    const lastModified = last ? new Date(last) : now;
    return [
      ...localized(`/u/${slug}`, lastModified, "daily", 0.8),
      ...localized(`/u/${slug}/vouch`, lastModified, "monthly", 0.3),
    ];
  });

  return [...staticRoutes, ...profiles];
}
