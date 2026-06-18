import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n";

// Locale routing. Every page lives under the [locale] segment, so requests must
// carry an /en or /fr prefix. This middleware:
//   • passes prefixed requests through, exposing the locale to server components
//     via the `x-locale` request header (so getLocale() stays params-free) and
//     pinning the `locale` cookie so later unprefixed navigations stay in-locale;
//   • redirects unprefixed paths to the best locale (cookie → Accept-Language →
//     default), preserving the rest of the path and the query string.
// API routes, Next internals, metadata files, and static assets are excluded via
// the matcher and never get a prefix.

function pickLocale(req: NextRequest): string {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;

  const header = req.headers.get("accept-language");
  if (header) {
    for (const part of header.split(",")) {
      const tag = part.split(";")[0].trim().slice(0, 2).toLowerCase();
      if (isLocale(tag)) return tag;
    }
  }
  return DEFAULT_LOCALE;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const seg = pathname.split("/")[1];

  if (isLocale(seg)) {
    // Already locale-prefixed — let it through, but tell the app which locale and
    // remember it for subsequent unprefixed links.
    const headers = new Headers(req.headers);
    headers.set("x-locale", seg);
    const res = NextResponse.next({ request: { headers } });
    if (req.cookies.get(LOCALE_COOKIE)?.value !== seg) {
      res.cookies.set(LOCALE_COOKIE, seg, {
        path: "/",
        maxAge: 31536000,
        sameSite: "lax",
      });
    }
    return res;
  }

  const locale = pickLocale(req);
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API, Next internals, metadata routes, and any path with a file
  // extension (static assets like /favicon.svg, /sitemap.xml, /robots.txt).
  matcher: ["/((?!api|_next|.*\\.).*)"],
};
