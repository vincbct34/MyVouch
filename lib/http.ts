/**
 * CSRF defense-in-depth: confirm a state-changing request originated from our
 * own site. SameSite=lax already blocks most cross-site cookie sends; this adds
 * an explicit Origin/Referer host check so a forged cross-origin POST is
 * rejected even if a future cookie/policy change weakens that guarantee (#6).
 *
 * All callers are POST/PATCH handlers. Browsers always attach an Origin header
 * to those methods (even same-origin), so we require a same-origin Origin or
 * Referer and reject when neither is present — a real same-origin browser
 * request will always have one.
 */
export function isSameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;

  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source) return false;

  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}
