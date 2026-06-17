---
name: vouch-redesign
description: >
  "Vouch" design system — the target visual identity for redesigning this QReview app
  (verified-endorsements / reviews product). Use whenever the user asks to redesign,
  restyle, rebrand, or rebuild the UI of this app, mentions "Vouch", "the new design",
  "the handoff", or asks to update public/index.html, company.html, review.html,
  admin.html, css/style.css, or css/admin.css to match the new look. High-fidelity
  spec: exact colors (oklch), type, spacing, radii, shadows, and component markup are
  all defined — do not invent new values, reuse these tokens.
---

# Vouch Design System (redesign target for QReview)

QReview is being restyled to match the **Vouch** brand — "Verified Endorsements".
Same domain (collect → verify → moderate → publish reviews/endorsements), new visual
language. The current app is **plain HTML/CSS/JS + Express** (`public/*.html`,
`public/css/*.css`, `public/js/*.js`) — **keep that stack**. Do not introduce
React/Vite; port the tokens and components into the existing CSS files and partials.

**Canonical references (read these, don't guess):**

- `assets/brand.css` — the entire design system as CSS custom properties + component
  classes. This is the source of truth; port it into `public/css/style.css` /
  `admin.css` (or a new `theme.css` imported by both).
- `assets/Design System.html` — visual reference for every token/component rendered.
- `assets/screens/Public Profile.html` — verified-endorsement wall (closest analog to
  `company.html` / a profile-style `index.html`).
- `assets/screens/Admin Dashboard.html` — moderation queue (target for `admin.html` +
  `css/admin.css`, `js/admin.js`).
- `assets/screens/Submit Review.html` — guided submission form (target for the review
  submission flow, e.g. `review.html` / submission section of `index.html`).

Open any screen file in a browser to see the intended result — they include working JS
for tabs, filters, star ratings, resolve/approve-decline, toasts, etc. Recreate the
**markup/CSS/behavior**, not copy-paste verbatim; adapt class names to whatever
partials/templates QReview already uses, but match pixels exactly.

## Mapping: QReview pages → Vouch screens

| QReview file                                                        | Vouch screen to match                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `public/company.html` (+ `index.html` listing)                      | Public Profile — endorsement wall, hero, stat strip, masonry review cards                  |
| `public/admin.html` + `public/css/admin.css` + `public/js/admin.js` | Admin Dashboard — moderation queue, KPIs, tabs, approve/decline, verification signals      |
| `public/review.html` (submission form)                              | Submit Review — guided multi-step form, stars, relationship tiles, skills                  |
| `public/css/style.css`                                              | Apply `brand.css` tokens globally (fonts, colors, buttons, badges, chips, inputs, top nav) |

QReview's existing concepts map directly: "avis" → Review/endorsement, "entreprise" →
the profile owner being reviewed, admin validation queue → moderation queue,
"vérification SIRET/LinkedIn" → the verification signals shown in `.verify-list`
(reuse this for "Work email confirmed" / "Identity verified" style badges).

## Design Tokens (from `brand.css :root`)

Authored in **oklch**; hex given as fallback. Prefer oklch.

### Neutrals

| Token         | oklch                    | ~Hex      | Use                         |
| ------------- | ------------------------ | --------- | --------------------------- |
| `--ink`       | `oklch(0.245 0.022 256)` | `#22262f` | Primary text, dark surfaces |
| `--ink-2`     | `oklch(0.38 0.020 256)`  | `#3f4651` | Secondary text              |
| `--ink-soft`  | `oklch(0.52 0.016 256)`  | `#5f6671` | Muted text, captions        |
| `--ink-faint` | `oklch(0.66 0.012 256)`  | `#868c95` | Placeholders, faint labels  |
| `--paper`     | `oklch(0.992 0.003 250)` | `#fbfbfc` | Page background, cards      |
| `--paper-2`   | `oklch(0.974 0.005 252)` | `#f4f5f7` | Subtle panels               |
| `--paper-3`   | `oklch(0.955 0.007 254)` | `#eef0f3` | Recessed surfaces           |
| `--line`      | `oklch(0.905 0.009 256)` | `#dde0e5` | Borders                     |
| `--line-soft` | `oklch(0.935 0.007 256)` | `#e7e9ed` | Subtle dividers             |

### Brand (trust blue)

| Token           | oklch                    | ~Hex      | Use                               |
| --------------- | ------------------------ | --------- | --------------------------------- |
| `--brand`       | `oklch(0.515 0.132 256)` | `#3f63c4` | Primary buttons, links, logo mark |
| `--brand-deep`  | `oklch(0.405 0.115 258)` | `#314e9c` | Hover, emphasized text            |
| `--brand-press` | `oklch(0.355 0.100 259)` | `#2b4486` | Active/pressed                    |
| `--brand-tint`  | `oklch(0.955 0.028 256)` | `#eaeefb` | Light wash backgrounds            |
| `--brand-tint2` | `oklch(0.915 0.045 256)` | `#d6def7` | Quote marks, selection            |
| `--on-brand`    | `oklch(0.985 0.006 250)` | `#f9fafc` | Text on brand fills               |

### Functional states (moderation status only — never decorative)

| Token             | oklch                    | ~Hex      | Meaning                                 |
| ----------------- | ------------------------ | --------- | --------------------------------------- |
| `--verified`      | `oklch(0.560 0.108 168)` | `#28a07f` | Verified / Published / Approved         |
| `--verified-deep` | `oklch(0.430 0.090 168)` | `#1d7a60` | Verified text on tint                   |
| `--verified-tint` | `oklch(0.955 0.032 168)` | `#e3f5ee` | Verified badge bg                       |
| `--amber`         | `oklch(0.760 0.135 76)`  | `#e0a13a` | Pending / awaiting review; star ratings |
| `--amber-deep`    | `oklch(0.560 0.120 64)`  | `#a06e1f` | Pending text on tint                    |
| `--amber-tint`    | `oklch(0.960 0.045 80)`  | `#f8efdb` | Pending badge bg                        |
| `--rose`          | `oklch(0.585 0.165 22)`  | `#cc5347` | Declined / needs attention              |
| `--rose-deep`     | `oklch(0.470 0.150 24)`  | `#a53b32` | Declined text on tint                   |
| `--rose-tint`     | `oklch(0.958 0.030 22)`  | `#f8e7e4` | Declined badge bg                       |

### Typography

- **`--sans`: 'Hanken Grotesk'** — all UI, headings, body. Weights 400–800.
- **`--serif`: 'Newsreader'** (opsz 6–72) — testimonial/quote text only, italic for
  quotes. `em` inside a quote → `--brand-deep`.
- **`--mono`: 'JetBrains Mono'** — labels, kickers, timestamps, counters, badges.

Google Fonts:

```
https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500&family=JetBrains+Mono:wght@400;500;600&display=swap
```

| Role                | Family            | Size                         | Weight | Letter-spacing   | Line-height |
| ------------------- | ----------------- | ---------------------------- | ------ | ---------------- | ----------- |
| Display             | Hanken            | `clamp(2.6rem,6vw,4.4rem)`   | 800    | -0.035em         | ~0.98       |
| H1 (hero)           | Hanken            | `clamp(2.8rem,5.6vw,4.6rem)` | 800    | -0.04em          | 0.98        |
| H2 (section)        | Hanken            | `clamp(1.8rem,3.5vw,2.6rem)` | 700    | -0.02em          | 1.08        |
| H3                  | Hanken            | 17–20px                      | 700    | -0.01–-0.02em    | 1.1         |
| Quote (testimonial) | Newsreader italic | 19px (cards), up to 26px     | 400    | -0.01em          | 1.38–1.5    |
| Body                | Hanken            | 15–17px                      | 400    | 0                | 1.55        |
| Button              | Hanken            | 15px (sm 13.5, lg 16.5)      | 600    | -0.01em          | —           |
| Kicker / label      | JetBrains Mono    | 11.5–14px                    | 500    | 0.14em UPPERCASE | —           |
| Badge text          | JetBrains Mono    | 11.5px                       | 500    | 0.04em UPPERCASE | —           |

Headings `text-wrap: balance`, paragraphs `text-wrap: pretty`, body line-height 1.55.

### Radii

`--r-xs:6px` `--r-sm:9px` `--r-md:13px` `--r-lg:18px` `--r-xl:26px` `--r-pill:999px`

### Shadows

- `--shadow-sm`: `0 1px 2px oklch(0.245 0.022 256 / .06), 0 1px 1px oklch(0.245 0.022 256 / .04)`
- `--shadow-md`: `0 4px 14px oklch(0.245 0.022 256 / .07), 0 2px 4px oklch(0.245 0.022 256 / .04)`
- `--shadow-lg`: `0 18px 48px oklch(0.245 0.022 256 / .12), 0 6px 16px oklch(0.245 0.022 256 / .06)`
- `--shadow-brand`: `0 10px 28px oklch(0.515 0.132 256 / .28)` (primary-button hover)

### Spacing / layout

- Content max width `--maxw: 1200px`; `.wrap` centers it, `padding-inline: 28px`
  (18px ≤720px).
- Common gaps: 8,10,12,14,16,18,22,26,30px. Section vertical padding 76px desktop.
- Card padding: review cards 26px; panels 26px; form steps 26–28px.

## The Logo

Speech bubble fused with a checkmark — quote (endorsement) + check (verification).
32×32 SVG, `currentColor` = `--brand` for the bubble, `--on-brand` for the check stroke:

```html
<svg
  class="mark"
  viewBox="0 0 32 32"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path
    d="M6 4h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H15l-6.4 5.2a.8.8 0 0 1-1.3-.62V23H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
    fill="currentColor"
  />
  <path
    d="M10.2 14.3l3.7 3.8 7.9-8.4"
    stroke="var(--on-brand)"
    stroke-width="2.7"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
```

Wordmark "Vouch" (or QReview's name set in this style): Hanken 800,
`letter-spacing:-0.03em`, 22px (34px mark) default / 30px (46px mark) large. On dark
surfaces wordmark → `--paper`, check stroke → `--ink`.

## Components (all CSS in `brand.css`)

- **Buttons `.btn`** — pill, font 15/600, padding `12px 20px`, gap 9px, transition
  `transform .12s, background .15s, box-shadow .15s`; `:active` → `translateY(1px)`.
  Variants: `.btn-primary` (brand fill, hover → `--brand-deep` + `--shadow-brand`),
  `.btn-ghost` (paper bg, `--line` border), `.btn-dark` (ink fill), `.btn-verified`
  (verified-green fill), `.btn-rose` (paper bg, rose text). Sizes `.btn-sm`
  (`8px 14px`,13.5px), `.btn-lg` (`15px 26px`,16.5px). Icons `.ic` 18px.
- **Badges `.badge`** — mono 11.5px uppercase pill + 6px `.dot`. Variants
  `.badge-verified` / `.badge-pending` / `.badge-declined` / `.badge-neutral` /
  `.badge-brand` (tinted bg + deep text + solid dot).
- **Chips `.chip`** — relationship tags, 13px/500 pill, paper bg + `--line` border.
  `.chip-solid` = brand-tint bg, brand-deep text, no border.
- **Avatar `.avatar`** — circle (`.sq` → 30% radius), white bold initials. Sizes `.sm`
  34px, default 44px, `.lg` 64px, `.xl` 92px. BG cycles `.a1`–`.a6`.
- **Star rating `.stars`** — 16px (`.lg` 20px) inline SVGs, filled = `--amber`, empty
  `.off` = `--line`. Path:
  `M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.6 5.9 21l1.4-6.8L2.2 9.6l6.9-.7z`
- **Review card `.review`** — paper bg, `--line` border, `--r-lg`, `--shadow-sm`,
  padding `26px 26px 22px`, gap 18px, hover → `--shadow-md`. Contains `.qmark`
  (serif `"` glyph, `--brand-tint2`, 46px), `.body` (Newsreader 19px/1.5, `em` →
  italic `--brand-deep`), `.meta-row` (badges/chips/date), `.foot` (avatar + `.who`:
  `.nm` name 15/700, `.rl` role 13px muted).
- **Inputs `.input` / `.textarea` / `.select`** — 1.5px `--line` border, `--r-md`,
  padding `13px 15px`, 15.5px. Focus → border `--brand` + `0 0 0 4px --brand-tint`
  ring + white bg. `.field` = label (14/600) + control + optional `.hint`.
- **Segmented control `.segmented` / tabs** — pill track, `--paper-3` bg; active →
  paper bg + `--shadow-sm`; count badge `.ct` flips to brand fill when active. Admin
  uses underline-tab variant on dark (active = `--paper` text + `--brand` bottom
  border).
- **Stat tile `.stat`** — `.n` 30px/800 number (-0.035em), optional `.u` unit, `.l`
  13px muted label.
- **Top nav `.topnav`** — sticky, translucent paper bg, `backdrop-filter: blur(14px)`,
  bottom `--line`. 66px bar: brandmark left, nav links center (active = brand-tint
  pill), action button right. Hidden ≤720px (add mobile menu).

## Screens

### Public Profile (`assets/screens/Public Profile.html`)

Verified-endorsement wall. Top nav → **hero** (`radial-gradient(brand-tint)` + paper,
bottom border, 2-col grid `1fr auto`, padding `56px 0 44px`): left = `.avatar.xl` +
name block (name `clamp(2rem,4.4vw,3rem)`/800/-0.035em, role 18px `--ink-2`, location
14px muted, two badges "Identity verified"/"Open to work"); right = `.stat-strip` of
three `.stat-box` (Verified reviews / Avg rating "4.9/5" / Would rehire) + primary
"+ Request a reference". **Toolbar**: relationship `.filters` (All/Former
managers/Peers/Clients, mono counts, active = ink fill) + "Sorted by Most recent".
**Masonry**: `columns:3` (2 ≤1000px, 1 ≤640px), `column-gap:22px`, `.review` cards
`break-inside:avoid`, each shows quote/badge/chip/`.date` (mono, right)/author foot.
**CTA band**: ink-filled `--r-xl`, 2-col, "Worked with X? → Add your endorsement" +
primary linking to Submit. Responsive: hero → 1 col ≤860px, id-row stacks ≤640px,
masonry → 1 col ≤640px.

### Admin Dashboard (`assets/screens/Admin Dashboard.html`)

Moderation queue — the core validation flow. **Header** (`--ink` bg): brandmark +
`ADMIN` badge, right = "View public profile" ghost + owner avatar. Title "Moderation
queue" + **KPI row** (`.kpis`): Awaiting review (amber), Published (green), Avg
published rating, Declined this month — left-bordered separators. **Tab bar**
(sticky, dark): underline tabs Pending/Published/Declined/All with mono counts; right
= dark search box. **Queue** (`.queue`, bg `--paper-2`): `.mod` cards,
`grid-template-columns: 5px 1fr` where 5px `.rail` = status color (amber/verified/
rose). `.inner` = `1fr 300px` grid: left `.lead` = author row (avatar + name/role +
status badge), `.text` (Newsreader 19px, `em`→brand-deep), `.tags` (chip + stars +
mono "SUBMITTED …"); right `.side` (left border) = `.verify-list` of signals (check
icon `--verified` or muted clock/alert, "Work email confirmed"/"Overlap verified"/
"LinkedIn matched", failures in rose) then `.actions`: primary "Approve & publish"
(`.btn-verified`) + "Request edit" (ghost) + "Decline" (rose). One pending card is a
**low-trust example**: unverified email, no shared employer, generic text, "Needs
attention" badge, actions = "Ask to verify identity" + "Decline" — this demonstrates
the moderation judgment the UI must support. **Empty state** `#empty`: centered check

- "You're all caught up". **Toast** `#toast`: ink pill, bottom-center, slides up.

JS behavior to port: tabs filter `.mod` by `data-status`
(pending/approved/declined/all), show `#empty` when zero visible.
`resolve(card, status)` fades/translates card (~280ms), sets `data-status` +
`data-removed`, swaps status badge + `.side` to a resolved note ("Live on your public
profile" / "Hidden — not shown publicly"), recounts KPIs/tab badges, reapplies active
filter, fires toast. "Request edit"/"Ask to verify"/"Unpublish"/"Restore" currently
just toast — wire to real endpoints.

### Submit Review (`assets/screens/Submit Review.html`)

Guided form, single column max 660px, friendly/trust-building. Minimal top nav.
**Intro**: `.for` pill ("You're vouching for **Name**" + avatar), H1 "You're vouching
for X", supporting copy. **Form card** (`--r-xl`, shadow-md) of numbered steps
(`.step-num` mono chip):

1. Who are you? — Full name + Work email (required), Role + Company (2-col rows).
2. How did you work together? — `.rel-grid` (3-col) of 6 `.rel` tiles (Manager/Peer/
   Report/Client/Partner/Mentee), emoji+title+sub; selected = brand border +
   brand-tint bg.
3. Overall rating — 5× 38px interactive `.star` + dynamic word label
   ({1:Poor,2:Fair,3:Good,4:Great,5:Outstanding}).
4. Your endorsement — `.textarea` maxlength 600 + live `.counter`.
5. Strengths (optional) — toggle `.skill` pills, selected = ink fill.
   **Submit bar**: `.trust` line (shield icon, "Verified and held privately until X
   approves it") + primary "Submit endorsement". **Success** `#success`: green seal
   check, "Thank you — it's on its way", links to profile + admin.
   JS: relationship tiles single-select (`.sel`); stars hover-preview/click-commit,
   mouseleave restores committed value; skills multi-toggle; live char counter; submit
   prevents default, hides form, shows success, scrolls to top. Responsive: 2-col rows
   and rel-grid → 1 col ≤560px (rel-grid → 2-col).

## Motion

Buttons: `transform .12s`, color/shadow `.15s`, `:active` → `translateY(1px)`.
Cards/tiles hover: 180ms shadow + (screens) `translateY(-4px)`. Toast: opacity +
translateY `.25s`. Honor `prefers-reduced-motion`.

## Data model alignment

Vouch's `Review` entity (id, reviewerName/Email/Role/Company, relationship enum,
rating 1–5, body ≤600, strengths[], status pending/approved/declined, verification
{emailConfirmed, employerOverlapVerified, linkedinMatched}, submittedAt/resolvedAt)
maps onto QReview's existing `reviews.db` review/avis records — reuse existing
columns where they match (rating, body/comment, status/validated, company); add new
columns only if a field genuinely doesn't exist yet (e.g. relationship type,
strengths list, per-signal verification flags) rather than redesigning the schema
from scratch. SIRET verification ≈ `employerOverlapVerified`; LinkedIn OAuth ≈
`linkedinMatched`; email confirmation ≈ `emailConfirmed`.

## Assets

- Icons: inline SVGs (check, clock, alert, search, shield, star, close, quote glyph),
  stroke-width 2.2–2.7, round caps/joins. Swap for QReview's existing icon set if it
  differs, matching these weights.
- Avatars: initials on colored circles, no images (keep colored-initial fallback if
  photo avatars are added later).
- No raster images or third-party brand assets.
