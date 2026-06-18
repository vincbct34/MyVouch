import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n";

/**
 * Request-bound locale resolver. Mirrors the lib/auth ↔ lib/session seam:
 * lib/i18n.ts stays free of `next/*` so it's shareable/testable, and the
 * `next/headers` read lives here.
 *
 * The locale's source of truth is the URL's [locale] segment; middleware.ts
 * parses it and forwards it on the `x-locale` request header, so server
 * components resolve the active locale without threading route params. Falls
 * back to the default locale when the header is missing or invalid.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await headers()).get("x-locale");
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
