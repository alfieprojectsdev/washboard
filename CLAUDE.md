# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Washboard is a car wash queue management system built with Next.js 16, PostgreSQL, and TypeScript. Receptionists hand customers single-use magic links (QR codes); customers book and watch their queue position.

- Deployed at washboard.ithinkandicode.space (Vercel + Neon)
- Accounts are invite-only. The shop owner (role `admin`) invites staff and
  resets their passwords from `/dashboard/staff`; the first admin is created at
  `/signup` with `OWNER_SETUP_CODE`
- 166 tests, run against PGlite (real Postgres in WASM)
- Audit findings, deploy runbook and tradeoffs: `docs/PRODUCTION_READINESS.md`

## Common Commands

### Development
```bash
# Navigate to the app directory first
cd washboard-app

# Start development server
npm run dev

# Run type checking
npx tsc --noEmit

# Run linter
npm run lint
```

### Testing
```bash
# Run all tests (PGlite in-process Postgres, no database server needed)
npm test

# Watch mode for test-driven development
npm run test:watch

# Interactive test UI
npm run test:ui

# Coverage report
npm run test:coverage

# E2E tests with Playwright (requires production URL)
npx playwright test
```

### Database Operations
```bash
# Apply pending migrations (src/lib/migrations/*.sql, tracked in schema_migrations)
DATABASE_URL=... npm run db:migrate

# List applied/pending without changing anything
DATABASE_URL=... npm run db:migrate -- --status
```

### Building for Production
```bash
# Build the application
npm run build

# Start production server
npm start
```

## Architecture

### Layered Architecture Pattern

The codebase follows a clean layered architecture:

1. **API Routes** (`src/app/api/**/route.ts`) - Next.js serverless functions
   - Handle HTTP requests/responses
   - Validate inputs
   - Apply authentication middleware
   - Apply rate limiting
   - Delegate to service layer

2. **Service Layer** (`src/lib/magic-links/`, `src/lib/auth/`) - Business logic
   - Pure functions with database operations
   - Transaction management
   - Business rule validation
   - Token generation, password hashing, etc.

3. **Database Layer** (`src/lib/db.ts`) - Data access
   - Single PostgreSQL connection pool
   - Type-safe query helper
   - Production only; tests alias `@/lib/db` to `src/__tests__/helpers/test-db.ts` (PGlite)

### Database Schema Design

Six normalized tables with foreign key constraints:

```
branches → users (receptionists)
       ↓
   shop_status
       ↓
customer_magic_links ← bookings (queue)
       ↓
   sessions
```

**Critical Design Patterns:**

- Queue invariant: active bookings (queued, in_service) in a branch hold positions 1..N with no gaps or duplicates. Every queue write runs in a transaction that first calls `lockBranchQueue()` (`src/lib/bookings/queue.ts`, a `FOR UPDATE` on the branch row).
- Magic links are single-use because the submit route claims them with `UPDATE ... WHERE used_at IS NULL AND expires_at > NOW() RETURNING id`; a unique index on `bookings(magic_link_id)` backs this up. Never check-then-update in two statements.
- The tenant (`branch_code`) always comes from the session, never from request input.
- `updated_at` columns are maintained by triggers.

### Authentication & Session Management

- **Session-based auth** with PostgreSQL-backed storage (survives server restarts)
- **Session regeneration** on login prevents session fixation attacks
- **Cookie settings**: httpOnly, secure (production), sameSite: 'lax'
- **Rate limiting**: Login (5/15min), owner setup signup (3/hour), invite signup (10/hour), password reset (10/15min) per IP; change password (5/15min) per user
- **Password hashing**: bcrypt with cost factor 12 (~250ms per hash)
- **Removed accounts** (`users.disabled_at` set) can't log in, and `getUserBySessionId` ignores their sessions. Rows are never deleted because bookings and magic links refer to them.

**Staff accounts (migration 003):**
- `account_tokens` holds invite and reset tokens, SHA-256 hashed. The raw token is shown once to the admin and travels in the URL fragment (`/signup#invite=…`, `/reset-password#token=…`), then in the POST body. Invites last 7 days, resets 24 hours.
- Claim tokens with `claimAccountToken()` (one conditional `UPDATE … WHERE used_at IS NULL AND expires_at > NOW() RETURNING`), inside the transaction that uses them.
- Staff changes (`PATCH /api/staff/:userId`) lock the branch row, then re-check that the actor is still an active admin. A branch always keeps one active admin (`LAST_ADMIN`), and nobody changes their own role or access.
- A password reset or removal deletes the user's sessions; changing your own password deletes your other sessions.
- Recovery when no admin can log in: `DATABASE_URL=... node scripts/make-admin.mjs MAIN <username>`.

**Session Flow:**
1. User logs in via `/api/auth/login`
2. Credentials validated, bcrypt comparison
3. New session created in database with 24-hour expiration
4. Session ID stored in httpOnly cookie
5. Protected routes check session via `getSessionFromRequest()` helper

### API Endpoint Patterns

**Public Endpoints** (no auth):
- `GET /api/shop-status` - Check if accepting bookings
- `POST /api/magic-links/validate` - Validate token before booking
- `POST /api/bookings/submit` - Submit new booking
- `GET /api/bookings/:id/status` - Get real-time booking status and position

**Public auth endpoints** (the password, invite/reset token or setup code is the credential; all rate-limited):
- `/api/auth/signup`, `/api/auth/token-check`, `/api/auth/reset-password`, `/api/auth/login`

**Protected Endpoints** (receptionist auth required):
- Authentication: `/api/auth/logout`, `/api/auth/change-password`
- Magic Links: `/api/magic-links/generate|list`
- Queue Management: `/api/bookings` (GET), `/api/bookings/:id` (PATCH)
- Shop Control: `/api/shop-status` (POST)

**Admin Endpoints** (`requireAdmin()`, 403 for receptionists):
- `GET /api/staff`, `POST /api/staff/invites`, `DELETE /api/staff/invites/:id`
- `PATCH /api/staff/:userId`, `POST /api/staff/:userId/reset-link`

**Standard Response Format:**
```typescript
// Success
{ success: true, data: {...} }

// Error
{ error: "message", code: "ERROR_CODE" }
```

### Real-Time Queue Updates

Customer-facing booking confirmation page uses lightweight polling:
- Polls `/api/bookings/:id/status` every 10 seconds
- Updates position, status, and estimated wait time
- Stops polling when booking reaches terminal state
- No WebSockets/SSE needed (serverless-compatible)

**Performance**: ~60 requests/minute with 10 concurrent active bookings

### Testing Strategy

**Unit + Integration Tests with PGlite:**

- `vitest.config.ts` aliases `@/lib/db` to `src/__tests__/helpers/test-db.ts`, which applies the real migration files to PGlite (Postgres compiled to WASM). Constraints, triggers and `ON CONFLICT` all behave as on Neon.
- PGlite has one connection, so the shim serialises access like a one-connection pool. While a route holds `db.connect()`, it must use only that client; calling `db.query()` inside the transaction deadlocks the test (and would use a second connection in production).
- Fixtures must satisfy the constraints, e.g. `password_hash` must be 60 chars (use a bcrypt-shaped string).
- BIGINT columns come back as strings, as with node-postgres.
- Tests are organized by feature: `auth/`, `magic-links/`, `bookings/`, `dashboard/`, plus `production-hardening.test.ts`

**Key Testing Patterns:**
```typescript
import db from '@/lib/db'; // PGlite in tests

// Clean state between tests
beforeEach(async () => {
  await db.query('DELETE FROM bookings');
  await db.query('DELETE FROM customer_magic_links');
});

// Test database operations directly
const result = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
```

**E2E Tests with Playwright:**

- Configured to run against production URL (`washboard.ithinkandicode.space`)
- Single worker to prevent race conditions
- Tests in `e2e/` directory
- Used for portfolio screenshot capture

### Magic Link System

**Token Generation:**
- 128-character cryptographically secure tokens (crypto.randomBytes)
- 24-hour expiration
- Single-use enforcement (marked as `used_at` after booking)
- QR codes generated with qrcode package

**Validation Flow:**
1. Customer scans QR code or clicks link
2. Token extracted from URL query parameter
3. Backend validates: not expired, not used, exists in database
4. If valid, customer can submit booking
5. After booking, token marked as used

**URL Generation Pattern:**
```typescript
// Magic link URLs are dynamically generated from request headers
const protocol = request.headers.get('x-forwarded-proto') || 'http';
const host = request.headers.get('host') || 'localhost:3000';
const url = `${protocol}://${host}/booking?token=${token}`;
```

This ensures magic links use the correct domain in production vs development.

## Security Principles

**SQL Injection Prevention:**
- 100% parameterized queries, zero string concatenation
- Use pg-format for dynamic query construction when needed
- CHECK constraints for data validation at database level

**Password Security:**
- bcrypt hashing with cost factor 12
- New passwords need 12 to 200 characters (`passwordProblem()` in `src/lib/auth/validation.ts`)
- Database constraint: `password_hash` >= 60 characters
- Generic error messages prevent username enumeration

**Rate Limiting Pattern:**
```typescript
// Apply to sensitive endpoints
import { applyRateLimit, loginLimiter } from '@/lib/auth/rate-limit';

const rateLimitResult = await applyRateLimit(request, loginLimiter, 'login');
if (rateLimitResult) return rateLimitResult; // 429 response
```

**Session Security:**
- Session IDs are 64-character hex strings (32 random bytes)
- Stored in httpOnly cookies (XSS protection)
- Secure flag enabled in production (HTTPS-only)
- sameSite: 'lax' for CSRF mitigation
- 24-hour expiration with automatic cleanup

## Development Patterns

### Path Aliases
Use `@/` for imports from `src/`:
```typescript
import db from '@/lib/db';
import { getSession } from '@/lib/auth/session';
```

### Error Handling in API Routes
```typescript
try {
  // Business logic
  return NextResponse.json({ success: true, data });
} catch (error) {
  console.error('Descriptive context:', error);
  return NextResponse.json(
    { error: 'User-friendly message', code: 'ERROR_CODE' },
    { status: 500 }
  );
}
```

### Database Transactions
For operations that modify multiple rows or require atomicity:
```typescript
const client = await db.connect();
try {
  await client.query('BEGIN');
  await lockBranchQueue(client, branchCode); // serialises queue writes for the branch

  // Perform queries (on `client` only, never `db.query` inside the transaction)
  await client.query('UPDATE bookings SET position = position + 1 WHERE ...');
  await client.query('UPDATE bookings SET position = $1 WHERE id = $2', [newPos, id]);

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL` - canonical site URL for magic links (production)

**Optional:**
- `OWNER_SETUP_CODE` - lets someone create an admin account at `/signup`; set it only while creating the first owner, then delete it. Staff join through invite links whether or not it is set.
- `FEEDBACK_WEBHOOK_URL` - Discord webhook for feedback notifications
- `NEXT_PUBLIC_GOATCOUNTER_CODE` - Analytics tracking code

(`SESSION_SECRET` and `USE_MOCK_DB` are no longer read by anything.)

**Never commit .env.local** - Use .env.example as template

## Migration and Database Changes

### Adding a New Migration

1. Add `src/lib/migrations/00X_description.sql`. Make it re-runnable
   (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `ON CONFLICT DO NOTHING`); the
   migrations are the only schema source (there is no separate schema.sql).
2. `npm test` applies it to PGlite, and `schema.test.ts` re-runs every file
   to prove it is re-runnable.
3. Production gets it automatically: `npm run build` runs
   `scripts/migrate.mjs --vercel` first, which applies pending migrations
   only when `VERCEL_ENV=production` (preview and local builds skip it). A
   failed migration fails the build, so the previous deployment stays live.
   Keep migrations backward-compatible with the code that is still running.

## Deployment

**Current Setup:**
- Vercel (Next.js hosting)
- NeonDB (PostgreSQL serverless)
- Custom domain: washboard.ithinkandicode.space

**Deployment Checklist:**
1. Ensure environment variables are set in Vercel dashboard
2. Run `npm run build` locally to verify build succeeds
3. Push to main branch (auto-deploys on Vercel)
4. Verify post-deployment:
   - Homepage loads
   - Shop status endpoint responds
   - Receptionist login works
   - Dashboard shows queue
   - Magic link generation works with correct domain
   - Customer booking flow works

**Database migrations in production:**
- Applied by the production build (see above). Vercel's Build Command must stay
  the default (`npm run build`) for this to happen.
- Ensure migrations are backward-compatible with currently deployed code
- `DATABASE_URL=... npm run db:migrate -- --status` shows what is applied

## Important Constraints

**Branch Code:**
- Default branch is "MAIN"
- Must exist in `branches` table before users can be created
- All operations are scoped to branch_code

**Queue Position:**
- Positions are 1-indexed integers
- Active bookings (queued + in_service) in a branch hold exactly 1..N: no gaps, no duplicates
- Done/cancelled bookings keep their last position number but are out of the queue
- Every queue write holds the branch lock (`lockBranchQueue`)

**Magic Link Token:**
- Must be exactly 128 characters
- Must be unique across all links
- Single-use only (check `used_at IS NULL`)
- Must not be expired (`expires_at > NOW()`)

## Common Tasks

### Adding a New API Endpoint

1. Create route file in `src/app/api/your-feature/route.ts`
2. Implement HTTP method handler (GET, POST, PATCH, etc.)
3. Add authentication if needed: `const session = await getSessionFromRequest(request)`
4. Validate inputs and return proper error codes
5. Add tests in `src/__tests__/your-feature/api-routes.test.ts`

### Adding a New React Component

1. Create component in `src/components/` or feature-specific directory
2. Use TypeScript with proper prop types
3. Follow TailwindCSS v4 styling patterns
4. Ensure WCAG 2.1 AA compliance (4.5:1 contrast ratio minimum)
5. Add tests if component has complex logic

### Debugging Production Issues

**Check database state:**
```bash
# Connect to production database
psql $DATABASE_URL

# Common diagnostic queries
SELECT * FROM shop_status WHERE branch_code = 'MAIN';
SELECT * FROM bookings WHERE status = 'queued' ORDER BY position;
SELECT * FROM customer_magic_links WHERE used_at IS NULL AND expires_at > NOW();
```

**Check session issues:**
```bash
# See active sessions
SELECT sid, user_id, branch_code, expire FROM sessions WHERE expire > NOW();
```

**Check logs:**
- View Vercel deployment logs for errors
- Check NeonDB logs for query performance issues
- Use `console.error()` for structured error logging

## Code Quality Standards

- **TypeScript Strict Mode**: Enabled, resolve all type errors
- **ESLint**: Fix all linting errors before committing
- **Test Coverage**: Aim for 80%+ functional path coverage
- **Accessibility**: All text must meet 4.5:1 contrast ratio (WCAG 2.1 AA)
- **Security**: Follow OWASP Top 10 guidelines, use parameterized queries
- **Performance**: API endpoints should respond <500ms under normal load
