import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/url";

// Crawlers get the public surface (landing + /u/[slug] walls + vouch forms) and
// are kept out of owner-only, auth, and credential-bearing token routes. The
// token routes (/confirm, /manage, /confirm-email) carry secrets in the URL, so
// they must never be indexed — also enforced via X-Robots-Tag in next.config.js.
export default function robots(): MetadataRoute.Robots {
  const base = appBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        // Pages are locale-prefixed (/en, /fr); `*` covers every locale.
        "/*/dashboard",
        "/*/account",
        "/*/login",
        "/*/signup",
        "/*/confirm/",
        "/*/confirm-email/",
        "/*/manage/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
