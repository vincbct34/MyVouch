# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vouch — a multi-user "verified endorsements" product. Each user owns a public
endorsement wall at `/u/[slug]`, shares their link, collects references from
managers/peers/clients, and moderates every submission before it goes public.
Reworked from a single-tenant _QReview_ app onto Next.js 15 (App Router, React 19,
TypeScript) with a custom design system. No external auth or ORM — crypto-based
sessions and `better-sqlite3` only.

## Commands

```bash
npm run dev            # dev server on http://localhost:3000
npm run seed           # seed demo owner + endorsements (demo@vouch.app / password123 → /u/maya-okonkwo)
npm run build          # next build (runs in production mode — needs BASE_URL + SESSION_SECRET set)
```

The five CI checks, in the order CI runs them (`.github/workflows/ci.yml`, Node 22):

```bash
npm run format:check   # Prettier — run `npm run format` once after install so this passes
npm run lint           # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck      # tsc --noEmit
npm test               # node --test (needs Node >= 22.6 for --experimental-strip-types)
npm run build          # next build
```

Run a single test file: `node --experimental-strip-types --test tests/auth.test.ts`

First-time setup: `cp .env.example .env` and set `SESSION_SECRET` + `BASE_URL`.

## Architecture

**Auth seam — keep it.** `lib/auth.ts` holds pure crypto primitives (scrypt
password hashing, HMAC-signed session tokens, cookie options) with **no Next.js
imports** so it stays unit-testable in plain Node. The request-bound side lives
in `lib/session.ts` (`getCurrentUser`, imports `next/headers`). Don't collapse
these together or pull `next/*` into `lib/auth.ts`.

**Session revocation via epoch.** Each user row has a `session_epoch`. A token
embeds the epoch it was issued under; `getCurrentUser` rejects any token whose
epoch ≠ the user's current `session_epoch`. `bumpSessionEpoch` (logout-all,
password change) invalidates every existing session at once. Signature/expiry
validity alone is **not** sufficient — the epoch check is the revocation gate.

**Data layer.** `lib/db.ts` is a hand-written `better-sqlite3` layer — all SQL
lives there, exported as named functions (`getUserBySlug`, `createEndorsement`,
`moderateEndorsement`, …). Schema is defined once in `lib/schema.sql` (shared by
the app and `scripts/seed.mjs`). `migrate()` reconciles older `vouch.db` files by
ALTERing in missing columns from `EXPECTED_COLUMNS` — when you add a column, add
it to both `schema.sql` and that map. The connection is a per-process singleton
on `globalThis`; queries are **synchronous and block the event loop** (fine for
one instance, the deliberate scaling ceiling).

**Verification signals are earned booleans, never assumed.** An endorsement
carries three independent flags: `email_confirmed` (reviewer clicked the one-time
link mailed on submit, `/confirm/[token]`), `employer_overlap_verified` (set
automatically when reviewer + owner email domains match and the domain is not
free-mail — see the `FREE_MAIL` set in `lib/verify.ts`), and `linkedin_matched`
(owner toggles manually from the queue). Public badges/counts must reflect only
endorsements that actually carry a verified signal — nothing is "verified" by
default.

**Every state-changing API route follows the same guard order:** `isSameOrigin`
check (`lib/http.ts`, CSRF defense-in-depth → 403) → `getCurrentUser` for
owner-only routes (→ 401) → `rateLimitAll` on **both** an identity key and the
client IP so one IP can't lock out unrelated accounts (`lib/ratelimit.ts` → 429).
Mirror this when adding routes. See `app/api/auth/login/route.ts` for the full
pattern. Auth errors stay generic ("Incorrect email or password") and the login
path runs `dummyVerify` on unknown emails so response timing doesn't leak whether
an account exists.

**Routes** (App Router under `app/`): `/` landing · `/signup` `/login` ·
`/u/[slug]` public wall · `/u/[slug]/vouch` submission form · `/dashboard` owner
moderation queue · `/confirm/[token]` reviewer email confirmation. API under
`app/api/`. Shared React in `components/`, non-React helpers in `lib/`.

## Production-mode invariants

The app **throws on boot in production** (and `next build` runs in production
mode) if these are missing — set dummy values when building locally/CI:

- `SESSION_SECRET` — required, ≥ 16 chars, rejects `change_me`/`replace_with`
  placeholders. Falls back to a dev secret only when `NODE_ENV !== production`.
- `BASE_URL` — required in prod; canonical public links derive from it, **never**
  from untrusted Host headers (`lib/url.ts`).
- Email — `RESEND_API_KEY` or the `SMTP_*` group must be set in prod (confirmation
  flow). In dev, unconfigured email logs the link to the console.
- `TRUST_PROXY` defaults to `false`; only set `true` behind a proxy that controls
  `x-forwarded-for` / `x-real-ip`.

## Redesign work

When asked to redesign/restyle/rebrand the UI, or anything mentioning "Vouch
design system", "the handoff", or "the new design", use the **`vouch-redesign`
skill** — exact tokens (oklch colors, type, spacing, radii, shadows) are spec'd
there. Don't invent values; reuse the tokens. Design tokens are also ported into
`app/globals.css`.
