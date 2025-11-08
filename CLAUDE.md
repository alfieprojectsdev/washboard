# Washboard - Car Wash Queue Management System

**Project Type:** Production-Ready Web Application
**Client:** Local car wash proprietor (real business)
**Purpose:** Replace manual pen-and-paper queue management with digital system

---

## Project Overview

**Phases 0-7 Complete - PRODUCTION READY**

Washboard is a browser-based queue management system for car wash operations. Customers submit bookings via magic links (QR codes), and receptionists manage the queue through a tablet-friendly dashboard.

**Current Status:**
- ✅ 130/130 tests passing (100%)
- ✅ Security audit: 94/100 (EXCELLENT, zero P0 vulnerabilities)
- ✅ Quality review: 95/100 (production ready)
- ✅ All core features implemented and tested
- ⏳ **Next Step:** Phase 8 - Production Deployment (Vercel + NeonDB)

**Key Capabilities:**
- Magic link booking system with QR codes (contactless)
- Real-time queue management (10-second polling)
- Session-based authentication with rate limiting
- Shop status control (open/closed with reasons)
- Privacy-friendly analytics (GoatCounter)

---

## Implementation Status

**Current Phase:** Phase 7 Complete (Testing & QA)
**Next Phase:** Phase 8 (Production Deployment)

### Completed Phases (Phases 0-7)

✅ **Phase 0: Project Setup**
- Next.js 14 with App Router, TypeScript, React 19
- TailwindCSS v4 for styling
- Vitest testing framework with pg-mem (in-memory PostgreSQL)
- Core dependencies: bcrypt, passport, express-session, qrcode
- ESLint configuration

✅ **Phase 1: Database Schema**
- PostgreSQL schema with 6 tables (branches, users, bookings, magic_links, shop_status, sessions)
- Foreign key constraints and CHECK constraints
- Performance indexes for queue queries
- Migration scripts (001_initial_schema_up/down.sql)
- pg-mem compatibility layer for testing
- Auto-updating timestamps with triggers

✅ **Phase 2: Authentication System**
- Session-based authentication (httpOnly, secure, sameSite: 'lax')
- bcrypt password hashing (cost factor 12)
- Rate limiting on auth endpoints:
  - Login: 5 attempts per 15 minutes
  - Signup: 3 attempts per hour
- Session regeneration prevents fixation attacks
- Passport.js LocalStrategy integration
- Username validation (alphanumeric, 3-50 chars)
- Password strength requirements enforced

✅ **Phase 3: Magic Link System**
- Cryptographically secure token generation (128 characters)
- QR code generation for contactless booking (PNG, data URLs)
- 24-hour expiration with single-use enforcement
- Magic link validation with timing-safe comparison
- Automatic cleanup of expired links
- Booking ID tracking (links customer to booking)
- Receptionist-only generation endpoint

✅ **Phase 4: Customer Booking Form**
- Vehicle information input (plate, make, model)
- Optional customer details (name, Messenger contact)
- Queue position assignment with transaction safety
- Validation: plate format, vehicle fields required
- Success page with booking confirmation
- Shop status check (rejects bookings when closed)
- Magic link integration (validates token before booking)

✅ **Phase 5: Receptionist Dashboard**
- Queue management table with status badges
- Status updates: Queued → In Service → Done / Cancelled
- Position reordering (Move Up/Down buttons with transaction safety)
- Shop status toggle (open/closed with preset reasons)
- Magic link management UI:
  - Generate new magic links with QR codes
  - List active/expired links
  - Copy link URLs to clipboard
- 10-second polling for real-time updates
- Batch operations (cancel bookings, reopen shop)
- Authentication protection on all dashboard routes

✅ **Phase 6: GoatCounter Analytics**
- Privacy-friendly, cookieless analytics
- Pageview tracking (automatic on all pages)
- Event tracking:
  - Magic link generation
  - Booking submissions
  - Queue management actions (status updates, reordering)
  - Shop status changes
- No PII collection (GDPR-friendly)
- Lightweight client-side script

✅ **Phase 7: Testing & Quality Assurance**
- **130/130 tests passing** (7 test files, 100% pass rate)
- Security audit: **94/100** (EXCELLENT)
  - Zero P0 (critical) vulnerabilities
  - OWASP Top 10 compliance
  - 100% parameterized SQL queries
- Quality review: 95/100 (production ready)
- UX review: 82/100 (WCAG 2.1 AA partial compliance)
- Critical bug fixes:
  - Race condition in position updates (SERIALIZABLE isolation)
  - UI responsiveness issues
  - Build errors resolved
  - Session management edge cases
- Performance optimization:
  - Database indexes for queue queries
  - Efficient polling strategy

### Test Coverage

**Total Tests:** 130 passing
**Test Files:** 7
**Test Duration:** ~3-5 seconds
**Coverage:** ~80% functional paths, all critical flows tested

**Test Structure:**
```
src/__tests__/
├── database/
│   └── database-init.test.ts (12 tests)
├── auth/
│   └── auth-routes.test.ts (14 tests)
├── magic-links/
│   ├── magic-link-service.test.ts (18 tests)
│   └── api-routes.test.ts (23 tests)
├── bookings/
│   ├── booking-service.test.ts (18 tests)
│   └── booking-routes.test.ts (23 tests)
└── dashboard/
    └── receptionist-dashboard.test.ts (22 tests)
```

**Database Testing:**
- pg-mem (in-memory PostgreSQL) for fast, isolated tests
- Automatic cleanup between tests
- Full schema validation
- Transaction testing (SERIALIZABLE isolation)

### Security Audit Results

**Score:** 94/100 - EXCELLENT
**P0 Vulnerabilities:** 0 (zero critical issues)

**Key Strengths:**
- ✅ bcrypt password hashing (cost 12, industry standard)
- ✅ Secure session management (httpOnly, secure, sameSite)
- ✅ 100% parameterized SQL queries (zero SQL injection risk)
- ✅ Rate limiting on authentication endpoints
- ✅ Session regeneration (prevents fixation attacks)
- ✅ Input validation with CHECK constraints
- ✅ CSRF protection via sameSite cookies
- ✅ OWASP Top 10 compliance

**Deductions (-6 points, all minor):**
- Missing CSRF tokens on forms (-2, mitigated by sameSite: 'lax')
- No Content-Security-Policy headers (-2, recommended for Phase 8)
- No automated security scanning in CI/CD (-2, post-deployment)

**Deployment Readiness:** ✅ VERIFIED (safe for production)

---

## Technology Stack

**Frontend:**
- Next.js 14 (App Router, React Server Components)
- React 19.2.0
- TypeScript 5
- TailwindCSS v4 (utility-first CSS)

**Backend:**
- Next.js API Routes (serverless)
- Node.js runtime
- PostgreSQL (NeonDB for production)
- Passport.js (authentication)
- express-session (session management)

**Security:**
- bcrypt (password hashing, cost 12)
- connect-pg-simple (PostgreSQL session store)
- express-rate-limit (brute force protection)

**Testing:**
- Vitest v4 (unit + integration tests)
- pg-mem (in-memory PostgreSQL for testing)
- @vitest/ui (test visualization)

**Analytics:**
- GoatCounter (privacy-friendly, cookieless, GDPR-compliant)

**Development:**
- ESLint (code linting)
- TypeScript strict mode
- Git (version control)

---

## Core Features

All 5 core features are **IMPLEMENTED** and **TESTED**:

### 1. Magic Link System ✅
- Generate secure one-time booking links with QR codes
- 24-hour expiration, automatic cleanup
- Single-use enforcement (link invalidated after booking)
- Contactless booking for customers (scan QR → book)
- Receptionist-only generation (authenticated endpoint)

**Endpoints:**
- `POST /api/magic-links/generate` (create new link + QR code)
- `POST /api/magic-links/validate` (validate token before booking)
- `GET /api/magic-links/list` (list active/expired links)

### 2. Customer Booking Form ✅
- Vehicle information (plate, make, model - required)
- Optional customer details (name, Messenger contact)
- Magic link validation (token required)
- Queue position auto-assignment
- Shop status check (rejects if closed)
- Success confirmation page

**Endpoints:**
- `POST /api/bookings/submit` (create new booking)
- `GET /api/shop-status` (check if accepting bookings)

### 3. Receptionist Dashboard ✅
- Queue table with real-time updates (10s polling)
- Status badges (Queued, In Service, Done, Cancelled)
- Position reordering (Move Up/Down with transaction safety)
- Shop status toggle (open/closed with reasons)
- Magic link management panel
- Booking cancellation with reasons

**Endpoints:**
- `GET /api/bookings` (fetch queue, filter by status)
- `PATCH /api/bookings/:id` (update status, position)
- `POST /api/shop-status` (update open/closed state)

### 4. Queue Management ✅
- Transaction-safe position updates (SERIALIZABLE isolation)
- Automatic position normalization (gaps filled)
- Status transitions: Queued → In Service → Done / Cancelled
- Cancellation tracking (reason, receptionist, timestamp)
- Position reordering with database triggers

**Database Features:**
- Indexed queries for performance (branch_code, status, position)
- Foreign key constraints (data integrity)
- Audit trail (created_at, updated_at, cancelled_by)

### 5. Authentication & Authorization ✅
- Session-based authentication (Passport.js LocalStrategy)
- Rate limiting (login: 5/15min, signup: 3/hour)
- Username validation (alphanumeric, 3-50 chars)
- Password requirements (8+ chars, hashed with bcrypt cost 12)
- Protected receptionist routes
- Public customer booking routes

**Endpoints:**
- `POST /api/auth/signup` (create new user, rate limited)
- `POST /api/auth/login` (authenticate, rate limited)
- `POST /api/auth/logout` (destroy session)

---

## Database Schema

PostgreSQL schema with 6 tables (all created and indexed):

### Tables

**branches**
- `branch_code` (PRIMARY KEY) - Unique branch identifier (e.g., "MAIN")
- `branch_name` - Display name
- `location` - Physical location
- `avg_service_minutes` - Average car wash duration (for wait time estimation)
- `is_active` - Branch operational status
- Timestamps: `created_at`, `updated_at`

**users** (receptionists)
- `user_id` (SERIAL PRIMARY KEY)
- `branch_code` (FK → branches) - Branch assignment
- `username` - Login username (unique per branch)
- `password_hash` - bcrypt hash (60+ chars)
- `name`, `email`, `role` - User metadata
- Constraints: username validation, password length, email format, role enum
- Indexes: `idx_users_branch_username` (UNIQUE), `idx_users_email`

**customer_magic_links**
- `id` (BIGSERIAL PRIMARY KEY)
- `branch_code` (FK → branches)
- `token` (VARCHAR(128) UNIQUE) - Cryptographic token
- `customer_name`, `customer_messenger` - Optional customer info
- `expires_at` - 24-hour expiration timestamp
- `used_at` - Timestamp when link was used (NULL = unused)
- `booking_id` - FK to bookings (set when used)
- `created_by` (FK → users) - Receptionist who generated link
- Constraints: Messenger URL format validation
- Indexes: `idx_magic_links_token`, `idx_magic_links_branch_active`

**bookings**
- `id` (BIGSERIAL PRIMARY KEY)
- `branch_code` (FK → branches)
- `magic_link_id` (FK → customer_magic_links) - Source link
- `plate`, `vehicle_make`, `vehicle_model` - Vehicle info
- `customer_name`, `customer_messenger` - Optional contact info
- `preferred_time` - Customer's preferred time slot
- `status` - Enum: queued, in_service, done, cancelled
- `position` - Queue position (1 = first in line)
- `cancelled_reason`, `cancelled_by`, `cancelled_at` - Cancellation audit
- `notes` - Additional receptionist notes
- Timestamps: `created_at`, `updated_at`
- Constraints: status enum, position > 0
- Indexes: `idx_bookings_branch_status_position`, `idx_bookings_created_at`, `idx_bookings_magic_link`

**shop_status**
- `id` (SERIAL PRIMARY KEY)
- `branch_code` (FK → branches, UNIQUE) - One status per branch
- `is_open` - Boolean (true = accepting bookings)
- `reason` - Closure reason (e.g., "Maintenance", "Power outage")
- `updated_by` (FK → users) - Last receptionist who changed status
- `updated_at` - Last update timestamp
- Index: `idx_shop_status_branch`

**sessions** (express-session store)
- `sid` (VARCHAR(128) PRIMARY KEY) - Session ID
- `sess` (JSONB) - Session data
- `expire` - Expiration timestamp
- `user_id` (FK → users) - Logged-in user
- `branch_code` (FK → branches) - User's branch
- `created_at` - Session creation time
- Indexes: `idx_session_expire`, `idx_session_user`, `idx_session_branch`

### Schema Version Tracking

**schema_version**
- `version` (INTEGER PRIMARY KEY)
- `applied_at` - Migration timestamp

Current version: **1** (initial schema)

---

## API Endpoints

All endpoints **IMPLEMENTED** and **TESTED**:

### Public Endpoints (No Authentication)

**Shop Status**
- `GET /api/shop-status` - Check if branch is accepting bookings
  - Response: `{ is_open: boolean, reason?: string }`

**Magic Link Validation**
- `POST /api/magic-links/validate` - Validate token before booking
  - Body: `{ token: string }`
  - Response: `{ valid: boolean, customer_name?: string, customer_messenger?: string }`

**Customer Booking**
- `POST /api/bookings/submit` - Submit new booking
  - Body: `{ token, plate, vehicle_make, vehicle_model, customer_name?, customer_messenger? }`
  - Response: `{ success: boolean, booking_id: number, position: number }`

### Authenticated Endpoints (Receptionist Only)

**Authentication**
- `POST /api/auth/signup` - Create new user (rate limited: 3/hour)
  - Body: `{ branch_code, username, password, name, email? }`
- `POST /api/auth/login` - Authenticate (rate limited: 5/15min)
  - Body: `{ branch_code, username, password }`
- `POST /api/auth/logout` - Destroy session

**Magic Link Management**
- `POST /api/magic-links/generate` - Create new magic link + QR code
  - Body: `{ branch_code, customer_name?, customer_messenger? }`
  - Response: `{ id, token, booking_url, qr_code_data_url, expires_at }`
- `GET /api/magic-links/list` - List active/expired links
  - Query: `?branch_code=MAIN&status=active|expired|all`
  - Response: `{ links: [...] }`

**Queue Management**
- `GET /api/bookings` - Fetch queue
  - Query: `?branch_code=MAIN&status=queued|in_service|done|cancelled`
  - Response: `{ bookings: [...] }`
- `PATCH /api/bookings/:id` - Update booking status or position
  - Body: `{ status?: string, position?: number, cancelled_reason?: string }`
  - Response: `{ success: boolean, booking: {...} }`

**Shop Status Control**
- `POST /api/shop-status` - Update open/closed state
  - Body: `{ branch_code, is_open: boolean, reason?: string }`
  - Response: `{ success: boolean, shop_status: {...} }`

---

## Authentication Strategy

**Implementation Status:** ✅ COMPLETE

### Strategy Overview

- **Type:** Session-based authentication (Passport.js LocalStrategy)
- **Session Store:** PostgreSQL (connect-pg-simple)
- **Password Hashing:** bcrypt (cost factor 12)
- **CSRF Protection:** sameSite: 'lax' cookies
- **Rate Limiting:** express-rate-limit middleware

### Security Features

**Password Security:**
- Minimum 8 characters (enforced in signup)
- bcrypt hashing with cost 12 (industry standard, ~250ms/hash)
- Password strength validation (no common passwords)
- Database constraint: `password_hash` ≥ 60 chars

**Session Security:**
- httpOnly cookies (XSS protection)
- secure flag (HTTPS-only in production)
- sameSite: 'lax' (CSRF mitigation)
- Session regeneration on login (prevents fixation)
- 7-day expiration (configurable)

**Rate Limiting:**
- Login endpoint: 5 attempts per 15 minutes (per IP)
- Signup endpoint: 3 attempts per hour (per IP)
- Prevents brute force attacks

**Username Validation:**
- Alphanumeric + underscore/hyphen only
- 3-50 characters
- Unique per branch (not globally unique)
- Regex: `^[a-zA-Z0-9_-]{3,50}$`

### Session Flow

1. **Signup:** `POST /api/auth/signup`
   - Validate input (username, password, branch_code)
   - Check rate limit (3/hour)
   - Hash password (bcrypt cost 12)
   - Insert user → create session → return success

2. **Login:** `POST /api/auth/login`
   - Validate credentials
   - Check rate limit (5/15min)
   - bcrypt compare (timing-safe)
   - Regenerate session ID → store user_id → return success

3. **Logout:** `POST /api/auth/logout`
   - Destroy session in database
   - Clear cookie

### Protected Routes

**Middleware:** `isAuthenticated()` checks session validity

**Protected Pages:**
- `/dashboard` - Receptionist queue management UI
- All `/api/bookings/*` routes (except `/api/bookings/submit`)
- All `/api/magic-links/*` routes (except `/api/magic-links/validate`)
- `/api/shop-status` POST (updates)

**Public Pages:**
- `/booking/:token` - Customer booking form (token-protected)
- `/booking/success` - Booking confirmation
- `/api/shop-status` GET (read-only)
- `/api/bookings/submit` (magic link token required)

---

## Known Issues & Recommendations

### Non-Blocking Issues

**Accessibility (UX Score: 82/100):**
- 10 accessibility improvements recommended (ARIA labels, touch targets)
- WCAG 2.1 AA: Partial compliance (80%)
- Missing screen reader labels on icon buttons
- Mobile touch targets below 44x44px minimum (some buttons)
- Queue table not responsive on mobile (<640px)
- **Status:** Can deploy now, improve iteratively post-launch

**Minor Performance Optimizations:**
- Consider adding session cleanup cron job (delete expired sessions)
- Low-probability deadlock in concurrent position updates (fails gracefully with retry)
- Magic link QR code generation could be cached (currently generated on-demand)

**Technical Debt:**
- 12 linting warnings (pre-existing, non-blocking)
  - Unused variables in test files
  - Console.log statements (intentional for debugging)
- Replace browser `alert()` with toast notifications (UX improvement)
- No focus trap in modal dialogs (accessibility)

### Post-Launch Improvements (Phase 9+)

**Accessibility Enhancements:**
- Add ARIA labels for all icon buttons (screen readers)
- Increase mobile touch targets to 44x44px minimum
- Implement responsive card layout for queue table on mobile
- Add focus trap to modal dialogs
- Keyboard navigation improvements (Tab order)

**Performance:**
- Implement session cleanup cron job (daily)
- Add Redis caching for shop_status endpoint (high traffic)
- Optimize QR code generation (cache or pregenerate)

**UX Improvements:**
- Replace browser alerts with toast notifications (non-blocking)
- Add loading spinners during API calls
- Implement optimistic UI updates (instant feedback)
- Add confirmation dialogs for destructive actions

**Security Hardening:**
- Add Content-Security-Policy headers (XSS defense-in-depth)
- Implement CSRF tokens on forms (additional layer)
- Add automated security scanning in CI/CD (Snyk, Dependabot)
- Consider adding 2FA for receptionist accounts (optional)

---

## Development Workflow

### Initial Setup (COMPLETE)

✅ Project is fully set up and ready for production deployment.

**Already Configured:**
- Node.js 20+ with npm
- PostgreSQL database schema (migrations ready)
- Environment variables template (.env.example)
- Vitest test suite (130 tests passing)
- ESLint configuration

### Environment Variables

Create `.env.local` in `washboard-app/` directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/washboard

# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your-secret-key-here

# Next.js
NODE_ENV=development

# GoatCounter (optional, for analytics)
NEXT_PUBLIC_GOATCOUNTER_CODE=your-code-here
```

**Production (Vercel):**
- Set environment variables in Vercel dashboard
- Use NeonDB connection string for `DATABASE_URL`
- Generate strong `SESSION_SECRET` (32+ chars)

### Running the Application

```bash
cd washboard-app

# Install dependencies
npm install

# Run migrations (production only, first time)
psql $DATABASE_URL < src/lib/migrations/001_initial_schema_up.sql

# Development server
npm run dev
# → http://localhost:3000

# Build for production
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run all tests (130 tests)
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# UI mode (interactive test runner)
npm run test:ui

# Coverage report
npm run test:coverage
```

**Test Strategy:**
- Unit tests: Database queries, service functions
- Integration tests: API routes, authentication flows
- pg-mem: In-memory PostgreSQL (fast, isolated)
- No external dependencies (no database required for tests)

### Database Migrations

**Development:**
```bash
# Apply migration
psql $DATABASE_URL < src/lib/migrations/001_initial_schema_up.sql

# Rollback migration
psql $DATABASE_URL < src/lib/migrations/001_initial_schema_down.sql
```

**Production (Vercel + NeonDB):**
- Run migrations manually via NeonDB SQL Editor
- Or use migration tool (dbmate, node-pg-migrate, etc.)

---

## Common Commands

**Development:**
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build (verify before deploy)
npm start            # Start production server
```

**Testing:**
```bash
npm test             # Run all tests (130 tests, ~3-5s)
npm run test:watch   # Watch mode (auto-rerun)
npm run test:ui      # Interactive UI (browser-based)
npm run test:coverage # Coverage report
```

**Linting:**
```bash
npm run lint         # ESLint check (12 warnings, non-blocking)
```

**Database:**
```bash
# Connect to local database
psql $DATABASE_URL

# Run schema
psql $DATABASE_URL < src/lib/schema.sql

# Seed test data
psql $DATABASE_URL < src/lib/mock-seed.sql
```

**Git:**
```bash
git status           # Check current branch and changes
git log --oneline    # View commit history
git diff             # View uncommitted changes
```

---

## Future Enhancements (Post-Launch)

### Phase 9: Real-time Upgrades
- WebSocket or Server-Sent Events (SSE) for live queue updates
- Drag-and-drop queue reordering (instead of Move Up/Down buttons)
- Push notifications for customers (PWA)
- Real-time position updates on customer booking page

### Phase 10: Queue Intelligence
- Wait time estimation based on historical data
- Predictive analytics (busy hours, cancellation patterns)
- Daily/weekly performance dashboards
- Customer retention metrics
- Average service time tracking

### Phase 11: Multi-Branch Support
- Multi-location management (franchise mode)
- Branch-level dashboards
- Cross-branch reporting
- Role-based access control (Admin, Receptionist, Viewer)

### Phase 12: PWA & Offline Support
- Service worker caching
- Offline mode for receptionist dashboard
- Add to Home Screen prompt
- Push notifications (booking ready, queue updates)

### Phase 13: Customer Communication
- SMS notifications via Twilio (optional)
- Messenger bot integration (1-click booking)
- WhatsApp templates for booking confirmations
- Loyalty program (punch card, discounts)

### Phase 14: Advanced Features
- Payment integration (deposit, full payment)
- Appointment scheduling (pre-book time slots)
- Customer accounts (history, preferences)
- Review/rating system
- Automated marketing (email campaigns)

---

## Project Structure

```
washboard/
├── docs/                           # Documentation
│   ├── context_handoff.md          # Original spec
│   ├── washboard-status.md         # Project status (outdated)
│   └── ...                         # Phase planning docs
├── washboard-app/                  # Main application
│   ├── src/
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── api/                # API routes
│   │   │   │   ├── auth/           # Authentication endpoints
│   │   │   │   ├── bookings/       # Queue management
│   │   │   │   ├── magic-links/    # Magic link generation
│   │   │   │   └── shop-status/    # Shop open/closed
│   │   │   ├── booking/            # Customer booking pages
│   │   │   ├── dashboard/          # Receptionist dashboard
│   │   │   └── layout.tsx          # Root layout
│   │   ├── lib/                    # Business logic
│   │   │   ├── auth.ts             # Authentication utilities
│   │   │   ├── db.ts               # Database connection
│   │   │   ├── schema.sql          # Database schema
│   │   │   ├── migrations/         # Schema migrations
│   │   │   ├── services/           # Service layer
│   │   │   │   ├── bookingService.ts
│   │   │   │   ├── magicLinkService.ts
│   │   │   │   └── shopStatusService.ts
│   │   │   └── middleware/         # Express middleware
│   │   │       ├── auth.ts         # Auth guards
│   │   │       └── rateLimiter.ts  # Rate limiting
│   │   ├── __tests__/              # Test suite (130 tests)
│   │   │   ├── database/
│   │   │   ├── auth/
│   │   │   ├── magic-links/
│   │   │   ├── bookings/
│   │   │   └── dashboard/
│   │   └── types/                  # TypeScript types
│   ├── public/                     # Static assets
│   ├── package.json                # Dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── vitest.config.ts            # Test config
│   └── tailwind.config.ts          # TailwindCSS config
├── CLAUDE.md                       # This file
└── README.md                       # User-facing documentation
```

---

## Guidance for Future Claude Instances

### Understanding the Codebase

**Start Here:**
1. Read this file (CLAUDE.md) - complete project overview
2. Check `docs/context_handoff.md` - original requirements
3. Review `src/lib/schema.sql` - database structure
4. Examine `src/__tests__/` - test suite (130 examples)

**Architecture Principles:**
- Server-side rendering with React Server Components
- API routes in `src/app/api/` (serverless functions)
- Service layer in `src/lib/services/` (business logic)
- Database queries use parameterized SQL (100% of queries)
- Session-based authentication (no JWTs)
- Polling for real-time updates (10s interval, upgradeable to WebSocket)

### Common Tasks

**Adding a New Feature:**
1. Update database schema (create migration)
2. Add service function in `src/lib/services/`
3. Create API route in `src/app/api/`
4. Add frontend UI component
5. Write tests in `src/__tests__/`
6. Update this CLAUDE.md file

**Debugging Issues:**
1. Check test suite: `npm test` (130 tests should pass)
2. Review recent commits: `git log --oneline`
3. Check database schema: `psql $DATABASE_URL -c "\d+ tablename"`
4. Examine API route: `src/app/api/[endpoint]/route.ts`
5. Run test in watch mode: `npm run test:watch`

**Security Considerations:**
- NEVER commit secrets to Git (.env.local is gitignored)
- ALWAYS use parameterized queries (no string concatenation)
- ALWAYS validate user input (Zod, regex, CHECK constraints)
- ALWAYS check authentication before modifying data
- NEVER log sensitive data (passwords, tokens, PII)

### Code Style

**TypeScript:**
- Use strict mode (enabled)
- Prefer interfaces over types
- Use async/await (no raw Promises)
- Handle errors with try/catch

**React:**
- Use Server Components by default ('use client' only when needed)
- Avoid inline functions in JSX (performance)
- Use TailwindCSS utility classes (no custom CSS)

**Database:**
- Use transactions for multi-step operations
- Always use SERIALIZABLE isolation for position updates
- Add indexes for frequently queried columns
- Use CHECK constraints for validation

**Testing:**
- Write tests before fixing bugs (TDD)
- Use descriptive test names (what, when, expected)
- Test happy path + edge cases + error cases
- Use pg-mem for database tests (no external DB)

---

## Deployment Checklist (Phase 8)

### Pre-Deployment

- [ ] All 130 tests passing (`npm test`)
- [ ] Production build successful (`npm run build`)
- [ ] Environment variables prepared (.env.production)
- [ ] NeonDB database created (serverless PostgreSQL)
- [ ] Database migrations applied (001_initial_schema_up.sql)
- [ ] Session secret generated (32+ chars, cryptographically random)
- [ ] GoatCounter account created (analytics)

### Vercel Deployment

- [ ] Connect GitHub repository to Vercel
- [ ] Set environment variables:
  - `DATABASE_URL` (NeonDB connection string)
  - `SESSION_SECRET` (32+ char random string)
  - `NODE_ENV=production`
  - `NEXT_PUBLIC_GOATCOUNTER_CODE` (analytics code)
- [ ] Deploy to production
- [ ] Verify deployment:
  - [ ] Homepage loads
  - [ ] Shop status endpoint works (`/api/shop-status`)
  - [ ] Receptionist can log in
  - [ ] Dashboard loads
  - [ ] Magic link generation works
  - [ ] Customer booking flow works
  - [ ] Analytics tracking works

### Post-Deployment

- [ ] Monitor error logs (Vercel dashboard)
- [ ] Test on production domain
- [ ] Train receptionist on tablet usage
- [ ] Set up monitoring (uptime, performance)
- [ ] Configure custom domain (optional)
- [ ] Enable production analytics (GoatCounter)
- [ ] Create first receptionist account
- [ ] Generate first magic link for testing

### Rollback Plan

If issues occur:
1. Revert to previous deployment (Vercel dashboard)
2. Check database logs (NeonDB console)
3. Review error logs (Vercel logs)
4. Fix issue locally → test → redeploy

---

**Last Updated:** 2025-11-08
**Status:** Phases 0-7 Complete - PRODUCTION READY
**Next Step:** Phase 8 - Deploy to Vercel + NeonDB production
**Production Readiness:** ✅ VERIFIED (130 tests passing, security audit passed)
**Test Coverage:** 130/130 tests (100%)
**Security Score:** 94/100 (EXCELLENT)
**Quality Score:** 95/100 (production ready)

---

**For Questions or Issues:**
- Review test suite: `src/__tests__/` (130 examples)
- Check original spec: `docs/context_handoff.md`
- Database schema: `src/lib/schema.sql`
- API routes: `src/app/api/*/route.ts`

**Project Maintained By:** Alfie (ltpt420)
**Repository:** washboard (local, ready for GitHub)
**License:** Not specified (proprietary for client)
