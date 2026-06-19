# Changelog

All notable changes to **MyVouch** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-06-18

MyVouch is a multi-user "verified endorsements" product. Each user owns a public
endorsement wall at `/u/[slug]`, shares the link, collects references from
managers/peers/clients, and moderates every submission before it goes public.
Reworked from the single-tenant _QReview_ app onto Next.js 16 (App Router, React
19, TypeScript) with a custom design system, crypto-based sessions, and
`better-sqlite3` — no external auth or ORM.

### Added — Core platform (2026-06-17)

- **Auth & sessions** — scrypt password hashing, HMAC-signed session tokens, and
  cookie options in a Next-free `lib/auth.ts` (unit-testable). Session
  revocation via per-user `session_epoch`; tokens carry the epoch they were
  issued under, so `bumpSessionEpoch` (logout-all, password change) invalidates
  every live session at once.
- **Owner email verification** — signup mails a confirm link; the
  `employer_overlap` signal is gated on the owner having confirmed their own
  email, closing a forgeable "same company" badge.
- **Verification signals as earned booleans** — `email_confirmed`,
  `employer_overlap_verified` (auto-set on matching non-free-mail domains), and
  `linkedin_matched` (owner toggle). Public badges/counts reflect only signals
  that were actually earned.
- **Reviewer confirm flow** — one-time `confirm_token` with a 7-day TTL plus a
  cooldown-gated resend path, so a lost/expired link is no longer a dead-end.
- **Reviewer self-service withdrawal** — stable `manage_token` minted at
  creation, mailed to the reviewer; `/manage/[token]` allows a hard delete.
- **Owner moderation** — dashboard queue with approve/reject, plus owner-scoped
  edit/delete of endorsements, all written to an audit log.
- **Audit log** — `audit_log` table with writes on password change, logout-all,
  moderation, edit, and delete; read-only panel in the dashboard.
- **Public wall** — keyset (cursor) pagination ordered by `resolved_at, id`
  served from `idx_end_wall`; load-more endpoint. `PublicEndorsement` projection
  stops leaking `reviewer_email`/`confirm_token` to clients.
- **Bot defense** — honeypot + timing checks on the public submit form.
- **Durable email outbox** — `enqueueMail` persists to `email_outbox`, attempts
  an immediate send, and a 60s sweep retries unsent mail up to `MAX_ATTEMPTS`;
  Resend provider with a dev-console fallback.
- **Security guard chain** — every state-changing route runs same-origin check →
  `getCurrentUser` (owner-only) → `rateLimitAll` on both identity key and client
  IP. Generic auth errors + `dummyVerify` timing defense on login.
- **OpenGraph/Twitter metadata** + dynamic OG image for `/u/[slug]`.
- **Tooling** — CI (Node 22) running format check, lint, typecheck, tests,
  build; Prettier/ESLint config; `.env.example`; `vouch-redesign` design-system
  skill.

### Added — Product & polish (2026-06-18)

- **Internationalization** — locale-based routing via the `[locale]` route
  segment (`/en/…`, `/fr/…`); `middleware.ts` redirects unprefixed paths and
  forwards locale on the `x-locale` header. EN/FR message catalogs in a Next-free
  `lib/i18n.ts` (type checker enforces matching keys across locales).
  `LocaleSwitcher` swaps the URL's first segment.
- **SEO** — `robots.ts`, `sitemap.ts` (each path once per locale with hreflang
  alternates), per-locale canonical + hreflang via `localeAlternates`, and a
  Google site-verification file.
- **Account management** — avatar upload, email change, and account deletion.
- **QR code sharing** for endorsement-wall links.
- **Legal & profile pages** — legal notices, account pages, user profile pages,
  and a `Footer` component on the root layout.
- **UI** — `DashboardHeader` admin component; responsive tabbar and admin search;
  `TopNav` simplified.

### Changed

- Renamed the project from **vouch** to **myvouch**; updated CI to track the
  `master` branch.
- Adjusted Content-Security-Policy to allow images from `buymeacoffee.com`.
- Spacing/padding tweaks on large buttons and legal pages; URL encoding in the
  footer.

### Removed

- Static `Public Profile` / `Submit Review` HTML prototypes, superseded by the
  React redesign.

### Licensing

- Released under **Creative Commons Attribution-NonCommercial-NoDerivatives
  4.0**.
