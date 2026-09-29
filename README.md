# Washboard

Queue management for a car wash. The receptionist hands each walk-in customer a
QR code; the customer scans it, enters their plate and car, and watches their
place in the queue update on their phone. The receptionist moves cars through
queued → in service → done from a dashboard.

Live: [washboard.ithinkandicode.space](https://washboard.ithinkandicode.space)
(Vercel + Neon Postgres).

![Receptionist dashboard: shop status, the queue with wait estimates, and start/cancel/reorder actions](docs/screenshots/dashboard-queue.png)

## Screens

The receptionist generates a single-use booking link and shows its QR code:

![Magic link with its QR code expanded](docs/screenshots/magic-link-qr.png)

The customer scans it, books, and watches their place in the queue (polled
every 10 seconds). The Feedback button is on every page.

<p>
  <img src="docs/screenshots/customer-booking-form.png" width="200" alt="Customer booking form opened from the QR code">
  <img src="docs/screenshots/customer-queue-status.png" width="200" alt="Live queue position and estimated wait">
  <img src="docs/screenshots/feedback-dialog.png" width="200" alt="Feedback dialog">
</p>

The shop owner runs staff accounts from Dashboard → Staff, without a
developer. An invite is a single-use link (or QR code) that expires in 7 days:

![Staff page with a new invite link and its QR code](docs/screenshots/staff-invite.png)

The new receptionist opens it on their phone and picks their own username and
password. When someone forgets their password, the owner sends them a reset
link from the same page; removing access signs that person out at once.

<p>
  <img src="docs/screenshots/invite-signup.png" width="200" alt="Signup form opened from an invite link">
</p>

![Staff accounts with a reset link for one receptionist](docs/screenshots/staff-accounts.png)

Screenshots are from a local run on 2026-09-29 with made-up people.

## How it works

| Who | Does what | Auth |
|-----|-----------|------|
| Owner (admin) | Everything a receptionist does, plus invites staff, sends password reset links, changes roles, removes access | Same as receptionist, with `role = 'admin'` |
| Receptionist | Logs in, generates a single-use booking link + QR code, manages the queue, opens/closes the shop, changes their own password | Username + password + branch code; DB-backed session cookie |
| Customer | Opens the link, submits plate/make/model, sees position and estimated wait (polled every 10 s) | The link itself: 128-character random token, valid 24 h, works once |
| Anyone | "Feedback" button on every page | None (rate-limited, honeypot) |

Accounts are invite-only. The first owner account is created at `/signup` with
the code in `OWNER_SETUP_CODE`; after that, set the variable back to empty and
invite everyone else from the Staff page. Invite and reset tokens are stored
as SHA-256 hashes and carried in the URL fragment, so they don't reach server
logs or analytics.

Each branch (`branch_code`) is a tenant. The branch comes from the logged-in
receptionist's session, never from request input, and every queue query
filters on it.

## How the system fits together

Two diagrams: first the parts of production and how they connect, then one
booking's path through the app with the tests that pin each step. (Mermaid:
renders on GitHub; VS Code's preview needs the "Markdown Preview Mermaid
Support" extension.)

```mermaid
flowchart LR
  U["Phones and the counter PC<br/>customers, receptionists, owner"]
  DNS["Porkbun DNS<br/>washboard.ithinkandicode.space<br/>CNAME cname.vercel-dns.com"]
  subgraph VC["Vercel project: washboard (Hobby, root washboard-app/)"]
    PG["Pages, Next.js 16<br/>/book/[branchCode]/[token], /book/success<br/>/login, /signup, /reset-password<br/>/dashboard, /dashboard/magic-links<br/>/dashboard/staff, /dashboard/account"]
    API["API routes<br/>/api/auth, /api/bookings, /api/magic-links<br/>/api/staff, /api/shop-status<br/>/api/feedback, /api/health"]
    BLD["Build step, production builds only<br/>node scripts/migrate.mjs --vercel"]
  end
  DB[("Neon Postgres, free plan<br/>branches, users, sessions<br/>customer_magic_links, bookings, shop_status<br/>account_tokens, feedback, rate_limits<br/>schema_migrations, schema_version")]
  DC["Discord webhook<br/>one message per feedback<br/>only if FEEDBACK_WEBHOOK_URL is set"]
  GC["GoatCounter<br/>page counts, booking token replaced by [link]<br/>only if NEXT_PUBLIC_GOATCOUNTER_CODE is set"]
  UR["UptimeRobot, planned<br/>GET /api/health every 5 min"]
  U -- "DNS lookup" --> DNS
  DNS -- "CNAME" --> VC
  U -- "HTTPS" --> PG
  PG -- "fetch" --> API
  PG -- "session check" --> DB
  API <--> DB
  BLD -- "pending migrations" --> DB
  API -- "POST, 3 s timeout" --> DC
  U -- "count.js, from the browser" --> GC
  UR -. "planned" .-> API
```

Three arrows carry most of the story. Everything a phone does goes to the
Vercel project, except GoatCounter's script, which the browser loads
straight from GoatCounter. The only thing the server calls besides Neon is
the Discord webhook, and a Discord outage never loses feedback because the
row is written first. The schema changes in one place: the build step,
which applies pending migrations on production builds only. Preview
deployments use the same database and skip it.

```mermaid
flowchart TD
  S1["1. Receptionist logs in<br/>POST /api/auth/login, 5 tries per 15 min per IP<br/>bcrypt, removed staff refused<br/>new 24 h session, httpOnly cookie"] --> S2
  S2["2. Makes a booking link<br/>POST /api/magic-links/generate, own branch only<br/>128-char token, valid 24 h, works once<br/>QR code 100 to 1000 px"] --> S3
  S3["3. Customer opens /book/MAIN/token<br/>POST /api/magic-links/validate<br/>exists, not expired, not used<br/>page sent noindex, no-store"] --> S4
  S4["4. Customer submits plate, make, model<br/>POST /api/bookings/submit, shop must be open<br/>one conditional UPDATE claims the link<br/>branch row locked, position = MAX + 1"] --> S5
  S5["5. Customer watches the queue<br/>/book/success polls GET /api/bookings/:id/status every 10 s<br/>needs the same token, kept in the URL fragment<br/>wait = (position - 1) x avg_service_minutes"] --> S6
  S6["6. Staff work the queue<br/>GET /api/bookings: own branch, names, plates, Messenger<br/>PATCH /api/bookings/:id: Start, Complete, Move, Cancel with a reason<br/>active positions stay 1..N"] --> S7
  S7["7. Car in service, done or cancelled<br/>status page shows it and stops polling<br/>done or cancelled: cars behind move up"]
  S1 -.- T1["auth/auth-routes.test.ts · POST /api/auth/login<br/>auth/session.test.ts · regenerateSession (P0 Security Fix)<br/>staff/staff-management.test.ts · removing access"]
  S2 -.- T2["magic-links/api-routes.test.ts · POST /api/magic-links/generate<br/>magic-links/magic-links.test.ts · generateSecureToken<br/>production-hardening.test.ts · magic link generation"]
  S3 -.- T3["magic-links/api-routes.test.ts · POST /api/magic-links/validate"]
  S4 -.- T4["bookings/booking-flow.test.ts · POST /api/bookings/submit<br/>production-hardening.test.ts · magic link single use<br/>production-hardening.test.ts · queue positions"]
  S5 -.- T5["bookings/booking-status.test.ts · GET /api/bookings/:id/status<br/>it: refuses to show another customer's booking (wrong token)"]
  S6 -.- T6["dashboard/receptionist-dashboard.test.ts · GET /api/bookings<br/>dashboard/receptionist-dashboard.test.ts · PATCH /api/bookings/[id]<br/>dashboard/messenger-link.test.ts · messengerHref"]
  S7 -.- T7["bookings/booking-status.test.ts<br/>it: returns in_service, done and cancelled states<br/>production-hardening.test.ts · queue positions"]
  classDef access fill:#FAEEDA,stroke:#854F0B,color:#633806
  class S1,S2,S6 access
```

Test paths are under `washboard-app/src/__tests__/`. Amber marks where
access is handed out or customer data leaves the server. Step 1 gives a
session that can read every booking in the branch. Step 2 creates the
customer's only credential: whoever holds the link can book once, and the
same token later reads that one booking's status. Step 6 is where names,
plates and Messenger handles go to staff browsers. The status endpoint in
step 5 returns only the booking's status, position, estimated wait and the
time it was queued.

Mappings the boxes can't show: accounts exist before step 1. The owner
signs up at `/signup` with `OWNER_SETUP_CODE` (3 tries per hour per IP) and
invites everyone else from `/dashboard/staff` with a link that works once
within 7 days (`staff-management.test.ts`, "invite links"). The booking
token spans steps 2 to 5: it's in the page path at step 3, where GoatCounter
and feedback both record `[link]` instead, it's claimed at step 4, and it
moves to the URL fragment for step 5. Closing the shop (`POST
/api/shop-status`) blocks step 4 only, so a link made while the shop is
closed still works once it reopens, and a closed shop doesn't use a link
up. The Feedback button on every page posts to `/api/feedback` (5 per hour
per IP, with a honeypot field). Rate limits are keyed on the client IP
(the password change also on the user), stored in `rate_limits`, and let
requests through if the database errors.

## Stack

- Next.js 16 (App Router, route handlers), React 19, TypeScript, Tailwind CSS 4
- PostgreSQL via `pg` (Neon in production)
- bcrypt (cost 12) for passwords; sessions are random IDs stored in the
  `sessions` table, so logout and account deletion take effect immediately
- Login/signup/feedback rate limits stored in Postgres (`rate_limits`), which
  works across serverless instances
- `qrcode` for QR images, GoatCounter for cookieless page counts
- Vitest against PGlite (Postgres compiled to WASM), so tests exercise the real
  SQL, constraints and triggers without a database server

## Local development

```bash
cd washboard-app
npm install
cp .env.example .env.local      # set DATABASE_URL and OWNER_SETUP_CODE
npm run db:migrate              # applies src/lib/migrations/*.sql
npm run dev                     # http://localhost:3000
```

Then open `/signup`, enter the setup code to create the owner account, and
invite a receptionist from Dashboard → Staff.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | Postgres connection string (Neon pooled URL in production) |
| `NEXT_PUBLIC_APP_URL` | yes in production | Canonical URL used in magic links and QR codes |
| `OWNER_SETUP_CODE` | only to create the first owner | `/signup` with this code creates an admin account; delete it afterwards |
| `FEEDBACK_WEBHOOK_URL` | no | Discord webhook that gets a message per feedback submission |
| `NEXT_PUBLIC_GOATCOUNTER_CODE` | no | GoatCounter site code |

## Checks

```bash
npm test            # 199 tests, PGlite, no DB server needed
npm run typecheck
npx eslint src
npm run build
```

GitHub Actions is turned off for this repo, so run all four locally before
merging. `.github/workflows/ci.yml` runs them again if Actions is turned
back on.

## Deploying

See [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) for the
deploy runbook, the September 2026 audit findings and the tradeoffs behind
them.

## Layout

```
washboard-app/
  src/app/api/          route handlers (auth, staff, bookings, magic-links, shop-status, feedback, health)
  src/app/book/         customer pages (booking form, live queue status)
  src/app/dashboard/    receptionist pages; staff/ (admins) and account/ (own password)
  src/lib/auth/         sessions, rate limiting, invite and reset tokens
  scripts/              migrate.mjs, make-admin.mjs (recovery when no admin can log in)
  src/lib/migrations/   numbered SQL migrations (applied by scripts/migrate.mjs)
  src/__tests__/        Vitest suites
```
