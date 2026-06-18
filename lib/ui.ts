import type { Locale } from "./i18n";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar palette class (.a1–.a6) from a string. */
export function avatarClass(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `a${(h % 6) + 1}`;
}

/**
 * Canonical strength keys. These are the values persisted to the DB and
 * validated server-side, so they MUST stay stable and locale-independent —
 * display labels are translated separately (see `skillLabels` in lib/i18n.ts).
 */
export const SKILL_OPTIONS = [
  "Leadership",
  "Communication",
  "Strategy",
  "Execution",
  "Mentorship",
  "Technical depth",
  "Reliability",
  "Creativity",
  "Collaboration",
  "Ownership",
  "Problem solving",
  "Empathy",
];

const DATE_LOCALES: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
};

export function formatDate(iso: string, locale: Locale = "fr"): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString(DATE_LOCALES[locale], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Public URL for an owner's profile photo, or null when they have none.
 * Versioned by avatar_updated_at so the immutable cache is invalidated whenever
 * the photo changes (see app/api/u/[slug]/avatar).
 */
export function avatarUrl(
  slug: string,
  updatedAt: string | null,
): string | null {
  if (!updatedAt) return null;
  return `/api/u/${slug}/avatar?v=${encodeURIComponent(updatedAt)}`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function parseStrengths(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
