# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MyVouch — a multi-user "verified endorsements" product. Each user owns a public
endorsement wall at `/u/[slug]`, shares their link, collects references from
managers/peers/clients, and moderates every submission before it goes public.
Reworked from a single-tenant _QReview_ app onto Next.js 16 (App Router, React 19,
TypeScript) with a custom design system. No external auth or ORM — crypto-based
sessions and `better-sqlite3` only.

## Commands

```bash
npm run dev            # dev server on http://localhost:3000
npm run seed           # seed demo owner + endorsements (demo@myvouch.fr / password123 → /u/maya-okonkwo)
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

**i18n seam — mirrors the auth seam.** `lib/i18n.ts` holds the message catalogs
(`messages.en` / `messages.fr`) with **no `next/*` import**, so it's shared by
server and client and stays unit-testable. `Messages = typeof messages.en`
makes the type checker enforce that **every locale defines the same keys** — a
missing translation fails `typecheck`/`build`, not at runtime. The request-bound
side is `lib/locale.ts` (`getLocale`, reads the `x-locale` request header via
`next/headers`); for API routes use `apiMessages(req)` (`lib/apimsg.ts`), which
reads the cookie off the request. **Never pass the resolved catalog to a client
component as a prop** — it contains functions (interpolation helpers) that
aren't RSC-serializable. Instead `components/I18nProvider.tsx` carries only the
`Locale` string in context; client components call `useT()` (indexes `messages`
themselves). Server components call `getLocale()` then `getMessages(locale)`.

**Locale lives in the URL via the `[locale]` route segment** (`/en/…`, `/fr/…`)
— every page route is under `app/[locale]/` (API routes, `robots.ts`,
`sitemap.ts` stay at `app/` root, unprefixed). `middleware.ts` is the seam: it
redirects unprefixed paths to the best locale (cookie → `Accept-Language` →
`DEFAULT_LOCALE`), and for prefixed requests forwards the locale on the
`x-locale` header (which `getLocale()` reads, so page components stay
params-free) while pinning the `locale` cookie so later unprefixed links resolve
in-locale. The root layout (`app/[locale]/layout.tsx`) reads `params.locale` for
`<html lang>` and `notFound()`s on an invalid segment. `LocaleSwitcher` swaps the
URL's first segment and navigates (no longer a bare cookie write). SEO depends on
this: `localeAlternates` (lib/url.ts) emits per-locale canonical + hreflang, and
`sitemap.ts` lists each path once per locale with hreflang alternates — so each
language indexes as a distinct URL. Storage stays locale-independent:
`SKILL_OPTIONS` (lib/ui.ts) are canonical English keys persisted/validated, with
display labels in `messages[*].skillLabels`; relationship `value`s are likewise
keys, labels live in the catalog.

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
the app and `scripts/seed.mjs`). `migrate()` reconciles older `myvouch.db` files by
ALTERing in missing columns from `EXPECTED_COLUMNS` — when you add a column, add
it to both `schema.sql` and that map. **`connect()` order is load-bearing:**
`dedupePending` → `migrate` → `db.exec(schema.sql)`. `migrate` must run _before_
the schema applies, because `schema.sql` (re)creates indexes that may reference a
just-added column (e.g. `idx_end_manage` on `manage_token`) — applying it first
would fail on a legacy DB whose table lacks that column. `migrate` skips tables
that don't exist yet (fresh DB). `connect()` also sets `PRAGMA foreign_keys = ON`
(off by default, per-connection) so the `ON DELETE CASCADE`s actually fire. The
connection is a per-process singleton on `globalThis`; queries are **synchronous
and block the event loop** (fine for one instance, the deliberate scaling
ceiling).

**Public wall pagination is keyset, not OFFSET.** `getApprovedEndorsements` takes
an opaque `Cursor` ((`resolved_at`, `id`), base64) and orders by
`resolved_at DESC, id DESC` — served from `idx_end_wall`. The SSR page seeds the
first cursor; `GET /api/u/[slug]/endorsements?cursor=…` returns the next page plus
`nextCursor` (null when exhausted). Don't reintroduce `LIMIT … OFFSET` here.

**Email goes through a durable outbox, never fire-and-forget.** Send via
`enqueueMail` (`lib/outbox.ts`), not `sendMail` (`lib/email.ts`) directly:
`enqueueMail` persists the message to `email_outbox` first, then attempts an
immediate background send, and a 60s sweep retries anything still unsent (failed
or never picked up) up to `MAX_ATTEMPTS`. A provider blip therefore never silently
drops a verification link. `lib/email.ts` stays the low-level sender (Resend via
`fetch`, or a dev-console fallback when `RESEND_API_KEY` is unset) and the only
direct caller of it is the outbox.

**Verification signals are earned booleans, never assumed.** An endorsement
carries three independent flags: `email_confirmed` (reviewer clicked the one-time
link mailed on submit, `/confirm/[token]`), `employer_overlap_verified` (set
automatically when reviewer + owner email domains match and the domain is not
free-mail — see the `FREE_MAIL` set in `lib/verify.ts`), and `linkedin_matched`
(owner toggles manually from the queue). Public badges/counts must reflect only
endorsements that actually carry a verified signal — nothing is "verified" by
default. (A hardcoded `identity_verified` owner badge with no way to earn it was
removed for exactly this reason — don't add a badge a signal can't earn.)

**Reviewers own their words — withdrawal via `manage_token`.** Each endorsement
gets a stable `manage_token` (minted at creation, never rotated/cleared, unlike
the single-use `confirm_token`) mailed to the reviewer. `/manage/[token]` lets
them withdraw — a hard delete via `POST /api/endorsements/withdraw`, guarded by
the standard same-origin → rate-limit chain (no account, the token is the
credential). The response is generic so the token can't probe what exists.

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
moderation queue (incl. a read-only audit-log panel — see `appendAuditLog` /
`getAuditLog`) · `/confirm/[token]` reviewer email confirmation ·
`/manage/[token]` reviewer self-service withdrawal. API under `app/api/`. Shared
React in `components/`, non-React helpers in `lib/`.

## Production-mode invariants

The app **throws on boot in production** (and `next build` runs in production
mode) if these are missing — set dummy values when building locally/CI:

- `SESSION_SECRET` — required, ≥ 16 chars, rejects `change_me`/`replace_with`
  placeholders. Falls back to a dev secret only when `NODE_ENV !== production`.
- `BASE_URL` — required in prod; canonical public links derive from it, **never**
  from untrusted Host headers (`lib/url.ts`).
- Email — `RESEND_API_KEY` must be set in prod (confirmation flow). In dev,
  unconfigured email logs the link to the console.
- `TRUST_PROXY` defaults to `false`; only set `true` behind a proxy that controls
  `x-forwarded-for` / `x-real-ip`.

## Redesign work

When asked to redesign/restyle/rebrand the UI, or anything mentioning "MyVouch
design system", "the handoff", or "the new design", use the **`vouch-redesign`
skill** — exact tokens (oklch colors, type, spacing, radii, shadows) are spec'd
there. Don't invent values; reuse the tokens. Design tokens are also ported into
`app/globals.css`.
