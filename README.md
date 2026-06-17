# MyVouch

**Verified endorsements.** MyVouch turns scattered word-of-mouth into a verified
wall of references that each user owns. Anyone can sign up, share their personal
link, collect endorsements from managers / peers / clients, and moderate every
submission before it goes public.

Reworked from the single-tenant _QReview_ app into a multi-user product on
**Next.js (App Router)** with the **MyVouch** design system.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript)
- **better-sqlite3** — local file database (`myvouch.db`)
- **Crypto-based auth** — scrypt password hashing + HMAC-signed session cookies
  (no external auth deps)
- **MyVouch design system** — tokens ported verbatim from the brand handoff into
  `app/globals.css` (Hanken Grotesk / Newsreader / JetBrains Mono, oklch colors)

## Getting started

```bash
npm install
cp .env.example .env        # set SESSION_SECRET and BASE_URL
npm run seed                # optional: demo owner + endorsements
npm run dev                 # http://localhost:3000
npm test                    # unit tests (requires Node >= 22.6)
```

### Quality checks

The same five steps the CI runs, in order:

```bash
npm run format:check        # Prettier
npm run lint                # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck           # tsc --noEmit
npm test                    # node --test
npm run build               # next build
```

`npm run format` rewrites files in place. **Run it once after installing** so
`format:check` passes — formatting wasn't enforced before this was added.

CI (`.github/workflows/ci.yml`) runs all five on every push to `main` and on
pull requests, on Node 22. The build step is given dummy `BASE_URL` /
`SESSION_SECRET` values because `next build` runs in production mode, where the
app fails fast if they're unset.

**Demo account** (after `npm run seed`):
`demo@myvouch.fr` / `password123` → public wall at `/u/maya-okonkwo`.

## Routes

| Path                | What                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `/`                 | Landing page                                                         |
| `/signup`, `/login` | Account creation / auth                                              |
| `/u/[slug]`         | Public endorsement wall (hero, stats, masonry, relationship filters) |
| `/u/[slug]/vouch`   | Guided endorsement submission form                                   |
| `/dashboard`        | Owner moderation queue (KPIs, tabs, approve / decline)               |

### API

- `POST /api/auth/signup` · `POST /api/auth/login` · `POST /api/auth/logout`
- `POST /api/auth/password` — change password (re-issues the current session,
  revokes all others)
- `POST /api/auth/logout-all` — log out of every device (bumps session epoch)
- `POST /api/u/[slug]/endorsements` — submit an endorsement (public)
- `GET  /confirm/[token]` — reviewer confirms their work email (public)
- `POST /api/endorsements/[id]/moderate` — approve / decline (owner only)
- `PATCH /api/endorsements/[id]/signals` — toggle the manual LinkedIn match (owner only)
- `PATCH /api/profile` — edit headline / location / LinkedIn / open-to-work (owner only)

All state-changing routes enforce a same-origin check (CSRF defense-in-depth)
and are rate-limited on both a target identity (email/slug) and the client IP,
so one IP can't lock out unrelated accounts.

## Data model

- **users** — profile owners (name, email, password hash, unique slug, headline,
  location, verification flags).
- **endorsements** — a reference _about_ a user: reviewer details, relationship,
  rating 1–5, body (≤600), strengths, status (`pending`/`approved`/`declined`),
  and verification signals (`email_confirmed`, `employer_overlap_verified`,
  `linkedin_matched`).

Verification signals are stored as explicit booleans and earned, not assumed:

- **`email_confirmed`** — set when the reviewer clicks the one-time link mailed
  to their work address on submission (`/confirm/[token]`).
- **`employer_overlap_verified`** — set automatically when the reviewer's email
  domain matches the profile owner's, excluding free-mail providers.
- **`linkedin_matched`** — a manual signal the owner toggles after checking the
  reviewer's LinkedIn from the moderation queue.

Public badges and counts reflect only endorsements that actually carry a
verified signal — nothing is labelled "verified" by default.

## Production notes

- **`SESSION_SECRET` is required** when `NODE_ENV=production` (≥ 16 chars) — the
  app throws on boot if it's missing, rather than falling back to a dev secret.
- **`BASE_URL` is required in production** and is used for canonical links shared
  from the dashboard. Do not derive public links from untrusted Host headers.
- **`TRUST_PROXY` defaults to `false`**. Set it to `true` only behind a trusted
  proxy or platform that strips client-supplied forwarding headers before adding
  `x-forwarded-for` / `x-real-ip`.
- **Email** is required for the confirmation flow. Set `RESEND_API_KEY` (and
  `EMAIL_FROM` on a Resend-verified domain). In production the app throws on boot
  if it's unset; in development, unconfigured email logs the confirmation link to
  the console. Sends go through a durable outbox (`email_outbox`) that retries on
  failure, so a provider blip never drops a link.
- **Rate limiting**: public submit, login, and signup endpoints are throttled on
  both an identity key and the client IP (in-memory). For multi-instance deploys,
  back `lib/ratelimit.ts` with a shared store (e.g. Redis).
- **Database**: `better-sqlite3` writes `myvouch.db` in the working directory —
  mount it on a persistent volume in production. The file (and its `-wal`/`-shm`
  sidecars) is git-ignored.
- A global error boundary (`app/error.tsx`) handles unexpected runtime errors.

## Scaling & limitations

This app is built to run as a **single Node instance**. Two design choices make
that explicit:

- **Synchronous SQLite.** `better-sqlite3` queries block the event loop. That's
  fast and simple at low-to-moderate traffic, but under heavy concurrent load
  requests serialize. Move to Postgres (async) before you need horizontal scale.
- **In-memory state.** The rate limiter and the DB connection are per-process.
  Running multiple instances would give each its own rate-limit buckets and its
  own SQLite file. Before scaling out: move the DB to a shared server and the
  rate limiter to Redis.

The schema is defined once in **`lib/schema.sql`** and shared by the app and the
seed script; `lib/db.ts` reconciles older databases by adding any missing
columns on connect.
