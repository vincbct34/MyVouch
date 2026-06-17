/**
 * Minimal in-memory fixed-window rate limiter (no external deps).
 *
 * Suitable for a single Node server (next start). For multi-instance
 * deployments, swap the Map for a shared store (Redis). Keyed by IP + bucket.
 */

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

// Upper bound on tracked keys. Identity-keyed buckets (per email/token) mean a
// spray of distinct values could otherwise grow the Map without bound between
// cleanup sweeps. When the cap is hit we prune expired entries first, then, if
// still full, evict the oldest by insertion order (Map preserves it).
const MAX_BUCKETS = 50_000;

function evictIfFull() {
  if (buckets.size < MAX_BUCKETS) return;
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  // Still full of live entries: drop the oldest ~10% to cap memory.
  if (buckets.size >= MAX_BUCKETS) {
    const drop = Math.ceil(MAX_BUCKETS * 0.1);
    let i = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++i >= drop) break;
    }
  }
}

export interface RateRule {
  key: string;
  limit: number;
  windowMs: number;
}

function tick(rule: RateRule): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hit = buckets.get(rule.key);

  if (!hit || now > hit.resetAt) {
    evictIfFull();
    buckets.set(rule.key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, retryAfter: 0 };
  }

  hit.count++;
  if (hit.count > rule.limit) {
    return { ok: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  return tick({ key, limit, windowMs });
}

/**
 * Apply several rules at once; the request is limited if ANY bucket trips.
 *
 * This lets callers key on both a target identity (email/slug) and the client
 * IP. When the IP can't be determined (no trusted proxy) the IP rule degrades
 * to a shared bucket, but the identity rule still confines the blast radius to
 * a single account/profile instead of locking out the whole app (#1).
 */
export function rateLimitAll(rules: RateRule[]): {
  ok: boolean;
  retryAfter: number;
} {
  let retryAfter = 0;
  let ok = true;
  for (const rule of rules) {
    const r = tick(rule);
    if (!r.ok) {
      ok = false;
      retryAfter = Math.max(retryAfter, r.retryAfter);
    }
  }
  return { ok, retryAfter };
}

/**
 * Best-effort client IP.
 *
 * Request does not expose the socket address in the Web API. To avoid letting
 * clients spoof rate-limit buckets, only honor proxy headers when the deploy
 * explicitly declares that upstream proxy headers are trusted (TRUST_PROXY).
 * When untrusted, returns a single shared token — callers MUST pair the IP rule
 * with an identity-scoped rule so this can't become a global lockout.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY !== "true") return "untrusted-ip";

  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "untrusted-ip";
}

// Periodically drop expired buckets so the Map can't grow unbounded.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }, 60_000);
  // Don't keep the event loop alive for cleanup alone.
  (timer as { unref?: () => void }).unref?.();
}
