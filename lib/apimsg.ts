import { getMessages, localeFromCookieHeader, type Messages } from "./i18n";

/**
 * Resolve the message catalog for an API request from its `locale` cookie.
 * Used for localized error responses and outgoing email copy. Falls back to
 * the default locale when the cookie is absent (e.g. crawlers, direct calls).
 */
export function apiMessages(req: Request): Messages {
  return getMessages(localeFromCookieHeader(req.headers.get("cookie")));
}
