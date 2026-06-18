import { DEFAULT_LOCALE, type Locale } from "./i18n";

/**
 * Canonical + hreflang alternates for a locale-prefixed page. `path` is the
 * locale-independent tail (e.g. "" for home, "/u/maya"); the result canonicalizes
 * to the current locale and links every locale (plus x-default → DEFAULT_LOCALE)
 * so search engines index each language as a distinct URL. Feed straight into a
 * route's `metadata.alternates`.
 */
export function localeAlternates(path: string, locale: Locale) {
  const base = appBaseUrl();
  const tail =
    !path || path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return {
    canonical: `${base}/${locale}${tail}`,
    languages: {
      en: `${base}/en${tail}`,
      fr: `${base}/fr${tail}`,
      "x-default": `${base}/${DEFAULT_LOCALE}${tail}`,
    },
  };
}

export function appBaseUrl(req?: Request): string {
  const configured = process.env.BASE_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      return url.origin;
    } catch {
      throw new Error("BASE_URL must be a valid absolute URL.");
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BASE_URL is required in production.");
  }

  if (req) {
    const host = req.headers.get("host");
    if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
      return `http://${host}`;
    }
  }

  return "http://localhost:3000";
}
