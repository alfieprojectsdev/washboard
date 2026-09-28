# Washboard: production readiness (September 2026)

Washboard has been live at washboard.ithinkandicode.space (Vercel Hobby + Neon)
since November 2025. An audit on 2026-09-26 found two ways to read or disrupt
customer data from the public internet and one bug that hangs a serverless
function per request. This document records what was found, what changed,
what it cost, and how to deploy it.

## Findings

| # | Severity | Finding | Evidence | Fix |
|---|----------|---------|----------|-----|
| 1 | Critical | The production `DATABASE_URL` (Neon, with password) is committed in the repo-root `.env`, and the repo is public. | The value is byte-identical to the one in the local `washboard-app/.env.production` (compared by SHA-256, 2026-09-28). | Untracked `.env` and `.env.local`. **The password must be rotated in Neon**; untracking does not remove it from history. |
| 2 | Critical | Anyone could create a receptionist account. Signup only checked that the branch code existed, and the form prefilled `MAIN`. A new account can read every customer's name, plate and Messenger handle. | `POST /api/auth/signup` had no other check; `/signup` returned 200 on the live site. | Signup requires `invite_code` matching `SIGNUP_INVITE_CODE` (constant-time compare). Unset variable = signup closed. |
| 3 | High | `GET /api/bookings/<unknown id>/status` never returns. The retry loop only counted errors, so an empty result looped forever, re-querying Neon until Vercel killed the function. | `curl https://washboard.ithinkandicode.space/api/bookings/999999/status` timed out after 25 s. The test for this case had been failing (timeout). | Loop removed; 404 returned immediately. Regression test asserts < 5 s. |
| 4 | High | One magic link could create two bookings. The submit route checked "unused" in one query and marked it used in another, without `AND used_at IS NULL`. | Code review; reproduced with two concurrent submits in the new test suite. | The link is claimed with one conditional `UPDATE … WHERE used_at IS NULL AND expires_at > NOW() RETURNING id` inside the transaction. A unique index on `bookings(magic_link_id)` backs it up. |
| 5 | Medium | Queue positions drifted. Finishing or cancelling a car left a gap, and new bookings took `COUNT(active) + 1`, which could equal an existing position. Two customers booking into an empty queue at the same moment both got position 1. | Code review; reproduced in tests. | Queue writes lock the branch row; leaving the queue closes the gap; new and re-queued bookings go to `MAX + 1`. |
| 6 | Medium | Booking status could be read for any booking ID (sequential integers, `Access-Control-Allow-Origin: *`). | Code review. | The status endpoint requires the booking's own (used) magic link token. The success page carries it in the URL fragment (`#t=…`), which browsers never send to servers, analytics or `Referer`. CORS header removed. |
| 7 | Medium | Live booking tokens were sent to GoatCounter as page paths. | GoatCounter's script records `location.pathname` by default; booking URLs are `/book/MAIN/<token>`. | Analytics path is rewritten to `/book/MAIN/[link]`; feedback does the same. |
| 8 | Medium | `next@16.0.7` had a critical advisory (fixed in 16.3.x); `express-rate-limit`, `ip-address`, `body-parser` and others had high/moderate ones. | `npm audit --omit=dev`. | Next 16.3.6, React 19.3.0. Passport, express-session, connect-pg-simple and express-rate-limit removed (none were imported). `npm audit --omit=dev`: 0. |
| 9 | Low | Migration 001 was `\i /home/ltpt420/...schema.sql`, so it only ran on one Linux machine. One index in the schema used `NOW()` in its predicate, which Postgres rejects, so it never existed. | File contents; PGlite rejects the statement. | 001 now holds the real SQL, written to be re-runnable. `npm run db:migrate` (Node, no psql) applies and records migrations. |
| 10 | Low | Tests ran on pg-mem with CHECK constraints, triggers and `ON CONFLICT` filtered out of the schema first, so fixtures like `password_hash = 'hash'` passed. | `src/lib/db.ts` filter list. | Tests run on PGlite with the real migrations. Four fixtures that violated constraints were fixed. 137/139 → 153/153. |

Smaller changes in the same branch: `NEXT_PUBLIC_APP_URL` is preferred over the
`Host` header for link URLs; QR size is clamped to 100–1000 px; a malformed
Messenger handle is a 400 instead of a database error; expired sessions are
swept at login; security headers (`X-Frame-Options`, `nosniff`,
`Referrer-Policy`) on every page and `noindex` + `no-store` on booking pages;
screenshot mode is ignored in production builds; one-off debug scripts from
November 2025 were deleted.

## New: feedback button

Every page has a "Feedback" button (bottom right). It opens a small dialog:
problem / idea / other, a message, and an optional "how can we reach you".
Submissions go to the `feedback` table. If `FEEDBACK_WEBHOOK_URL` is set, a
copy is posted to that Discord channel so it shows up as a phone notification.
Logged-in receptionists are linked by `user_id`.

Read it in the Neon SQL editor:

```sql
SELECT created_at, kind, message, contact, page FROM feedback ORDER BY created_at DESC;
```

Hosted form services were considered and not used:

| Option | Free tier (checked 2026-09-28) | Why not |
|--------|-------------------------------|---------|
| Own table + Discord webhook (chosen) | Neon storage already paid for by the free plan; Discord webhooks are free | Needs a few lines of code, which is done |
| Tally | Unlimited forms and responses | Customers leave the app; no link to the page or receptionist |
| Web3Forms | 250 submissions/month | Email only; another account to manage |
| Formspree | 50 submissions/month | Low cap |
| GitHub Issues | Free | The repo is public, so customer messages would be public |

## Deploy runbook

Do these in order. Steps 1–3 are dashboard work only you can do.

1. Rotate the Neon password: Neon Console → project → Branches → Roles →
   `neondb_owner` → Reset password. Copy the new pooled connection string.
2. Update env in Vercel (Project → Settings → Environment Variables,
   Production and Preview):
   - `DATABASE_URL` ← the new string
   - `NEXT_PUBLIC_APP_URL` ← `https://washboard.ithinkandicode.space`
   - `FEEDBACK_WEBHOOK_URL` ← optional, a Discord channel webhook
   - `SIGNUP_INVITE_CODE` ← only while onboarding a receptionist, then delete
   - delete `SESSION_SECRET` and `USE_MOCK_DB`; no code reads them

   Update your local `washboard-app/.env.production` with the new
   `DATABASE_URL` too, and delete `SESSION_SECRET` there and in `.env.test`.
3. Apply migration 002 against production before merging (the feedback
   route needs the table):
   ```bash
   cd washboard-app
   DATABASE_URL="<new pooled string>" npm run db:migrate -- --status
   DATABASE_URL="<new pooled string>" npm run db:migrate
   ```
   If it fails on `idx_bookings_one_per_magic_link`, production already has a
   duplicated booking; the migration file has the query to find it.
4. Merge the PR; Vercel deploys `main`.
5. Smoke-test on a phone:
   `/api/health` → `{"ok":true}`; `/api/health?db=1` → `"db":"ok"`;
   log in; generate a link; open it on another phone and book; the success
   page should show the position and update within 10 s; mark the car done
   on the dashboard; send a feedback message and find it in the table.
6. Add an uptime monitor. UptimeRobot's free plan (50 monitors, 5-minute checks,
   email alerts): add an HTTP monitor for
   `https://washboard.ithinkandicode.space/api/health`. Don't monitor
   `?db=1`: a check every 5 minutes would keep Neon's compute awake around the
   clock, and the free plan includes 100 compute-hours per month.
7. Optionally, rewrite git history to remove the old `.env`
   (`git filter-repo`). Once the password is rotated the leaked value is
   useless, so this is tidiness. It rewrites every commit hash and needs a
   force-push.

## Tradeoffs

- Signup uses one shared invite code rather than per-person invites or an
  admin screen. It's one environment variable and closes the hole today. Anyone who
  learns the code while it is set can make an account, so set it only while
  onboarding and delete it afterwards.
- Magic link tokens are stored in plaintext. Hashing them would stop a
  database leak from exposing unused links (valid 24 h), but the "Magic Links"
  page re-displays QR codes for active links, which needs the token.
- Customers mid-queue at deploy time lose live updates. Their success-page
  URLs have no `#t=` token, so polling stops (the page still shows their
  original position). New bookings are unaffected.
- The branch lock serialises every queue change in a branch. At a car
  wash's volume that is invisible; at hundreds of writes per second it would
  not be.
- Rate limits are per IP and fail open. Receptionists behind one shop
  Wi-Fi share a login budget (5 per 15 min). If the database errors, requests
  are allowed rather than blocking everyone.
- Vercel Hobby is "non-commercial, personal use only" under Vercel's fair
  use guidelines. If the car wash is a paying client, move to Pro
  ($20/month) or another host.
- Neon's free plan suspends compute after 5 minutes idle. The first
  request after a quiet spell waits for it to wake; `/api/shop-status` took
  10.3 s on 2026-09-26.
- There is no Content-Security-Policy yet. Next.js inline scripts need a
  nonce-based CSP, which is more setup than the other headers.

## Not done

- History rewrite for the leaked `.env` (step 7).
- Per-receptionist invites or an admin page for accounts.
- CSP header.
- End-to-end Playwright tests in CI (the existing `e2e/` specs target
  portfolio screenshots).
