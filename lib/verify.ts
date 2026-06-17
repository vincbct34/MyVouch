import type { User } from "./db";

/**
 * Free / consumer email providers. A shared domain here means nothing about a
 * shared employer, so overlap is never credited for these.
 */
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "fastmail.com",
  "tempmail.io",
]);

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return domain || null;
}

/**
 * True when the reviewer's email domain matches the profile owner's email
 * domain and that domain is a real (non-free-mail) organisation domain.
 * This is a heuristic "did you work at the same place" signal (#2b).
 *
 * Gated on the owner having CONFIRMED their own email: the comparison is against
 * the owner's email, so without that proof the owner could sign up under any
 * company domain and manufacture an overlap badge. No confirmation, no credit.
 */
export function employerOverlap(reviewerEmail: string, owner: User): boolean {
  if (!owner.email_confirmed) return false;
  const r = emailDomain(reviewerEmail);
  const o = emailDomain(owner.email);
  if (!r || !o) return false;
  if (FREE_MAIL.has(r) || FREE_MAIL.has(o)) return false;
  return r === o;
}
