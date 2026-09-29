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
