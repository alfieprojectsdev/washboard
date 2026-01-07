# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Washboard is a production-ready car wash queue management system built with Next.js 14, PostgreSQL, and TypeScript. It replaces manual pen-and-paper queue management with a modern, contactless digital solution using magic links and QR codes.

**Key Characteristics:**
- Real-world production application deployed at washboard.ithinkandicode.space
- Security-first architecture (94/100 security audit score)
- 130/130 tests passing with fast execution (~3-5 seconds)
- WCAG 2.1 AA accessibility compliant
- Uses NeonDB serverless PostgreSQL in production

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
# Run all tests (uses pg-mem, no real database needed)
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
# Apply schema migration
psql $DATABASE_URL < src/lib/migrations/001_initial_schema_up.sql

# Setup required data (MAIN branch + shop_status)
npm run db:setup

# Verify database setup and auto-repair if needed
npm run db:verify
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
   - Supports both real PostgreSQL and pg-mem for testing

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

- **Transaction Safety**: Position updates use SERIALIZABLE isolation level to prevent race conditions
- **Indexed Queries**: All performance-critical queries use proper indexes (`branch_code`, `status`, `position`)
- **Timing-Safe Comparisons**: Magic link token validation uses timing-safe comparison to prevent timing attacks
- **Automatic Timestamps**: `updated_at` columns use database triggers (only in real PostgreSQL, not pg-mem)

### Authentication & Session Management

- **Session-based auth** with PostgreSQL-backed storage (survives server restarts)
- **Session regeneration** on login prevents session fixation attacks
- **Cookie settings**: httpOnly, secure (production), sameSite: 'lax'
- **Rate limiting**: Login (5/15min), Signup (3/hour) per IP
- **Password hashing**: bcrypt with cost factor 12 (~250ms per hash)

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

**Protected Endpoints** (receptionist auth required):
- Authentication: `/api/auth/signup|login|logout`
- Magic Links: `/api/magic-links/generate|list`
- Queue Management: `/api/bookings` (GET), `/api/bookings/:id` (PATCH)
- Shop Control: `/api/shop-status` (POST)

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

**Unit + Integration Tests with pg-mem:**

- All tests run against in-memory PostgreSQL (pg-mem) for speed and isolation
- No external dependencies, tests run completely offline
- Schema automatically loaded and filtered for pg-mem compatibility
- Tests are organized by feature: `auth/`, `magic-links/`, `bookings/`, `dashboard/`

**Key Testing Patterns:**
```typescript
// Tests automatically use pg-mem via USE_MOCK_DB=true in vitest.config.ts
import db from '@/lib/db'; // Automatically uses pg-mem in tests

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
- Minimum 8 characters enforced in UI and backend
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
  await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

  // Perform queries
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
- `SESSION_SECRET` - 32+ character random string (generate with `openssl rand -base64 32`)

**Optional:**
- `NEXT_PUBLIC_GOATCOUNTER_CODE` - Analytics tracking code
- `USE_MOCK_DB=true` - Use pg-mem instead of real database (auto-set in tests)

**Never commit .env.local** - Use .env.example as template

## Migration and Database Changes

### Adding a New Migration

1. Create numbered migration files in `src/lib/migrations/`:
   - `00X_description_up.sql` - Apply changes
   - `00X_description_down.sql` - Rollback changes

2. Update `src/lib/schema.sql` with the full schema (single source of truth)

3. Apply migration:
   ```bash
   psql $DATABASE_URL < src/lib/migrations/00X_description_up.sql
   ```

4. Update tests if schema changes affect test data

### pg-mem Compatibility

The test database (pg-mem) doesn't support all PostgreSQL features. The `src/lib/db.ts` file automatically filters out unsupported features when loading the schema:

- CREATE TRIGGER and trigger functions
- CREATE EXTENSION
- COMMENT ON statements
- Regex constraints (~, ~*)
- LENGTH() function in CHECK constraints

If adding new database features, ensure they're either:
1. Supported by pg-mem, or
2. Filtered out in the schema loading logic

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
- Run migrations manually against production database before deploying code
- Ensure migrations are backward-compatible with currently deployed code
- Test migrations against staging database first

## Important Constraints

**Branch Code:**
- Default branch is "MAIN"
- Must exist in `branches` table before users can be created
- All operations are scoped to branch_code

**Queue Position:**
- Positions are 1-indexed integers
- Must be unique per branch + status combination
- Gaps in positions are allowed but should be avoided
- Position reordering requires SERIALIZABLE transaction isolation

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
