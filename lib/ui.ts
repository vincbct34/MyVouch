import type { Relationship } from "./db";

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

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  manager: "Manager",
  peer: "Peer",
  report: "Report",
  client: "Client",
  partner: "Partner",
  mentee: "Mentee",
};

export const RELATIONSHIP_TILES: {
  value: Relationship;
  emoji: string;
  title: string;
  sub: string;
}[] = [
  {
    value: "manager",
    emoji: "🧭",
    title: "I managed them",
    sub: "Was their manager",
  },
  {
    value: "report",
    emoji: "📈",
    title: "They managed me",
    sub: "Was my manager",
  },
  {
    value: "peer",
    emoji: "🤝",
    title: "We were peers",
    sub: "Same team or level",
  },
  {
    value: "client",
    emoji: "💼",
    title: "I was their client",
    sub: "Hired their work",
  },
  {
    value: "partner",
    emoji: "🔗",
    title: "We partnered",
    sub: "Cross-org collaboration",
  },
  {
    value: "mentee",
    emoji: "🌱",
    title: "They mentored me",
    sub: "Guided my growth",
  },
];

export const RATING_WORDS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Outstanding",
};

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

export function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
