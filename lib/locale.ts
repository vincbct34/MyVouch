import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./i18n";

/**
 * Request-bound locale resolver. Mirrors the lib/auth ↔ lib/session seam:
 * lib/i18n.ts stays free of `next/*` so it's shareable/testable, and the
 * `next/headers` cookie read lives here. Falls back to the default locale when
 * the cookie is missing or invalid.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
