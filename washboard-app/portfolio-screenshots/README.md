# Washboard - Portfolio Screenshots

**Project:** Car Wash Queue Management System
**Technology:** Next.js 14, TypeScript, PostgreSQL, TailwindCSS
**Status:** Production-Ready (130/130 tests passing)
**Resolution:** 1024x768 (tablet-optimized)

---

## Screenshots

### 01-booking-form.png (14 KB)
**Customer Booking Form**

The contactless booking interface accessed via QR code magic links. Customers can:
- Enter vehicle details (plate, make, model)
- Provide optional contact information (name, Messenger)
- Submit booking request
- Receive queue position and estimated wait time

**Key Features:**
- Mobile-first responsive design
- Form validation with clear error states
- Shop status check (rejects when closed)
- Magic link token validation

---

### 02-booking-success.png (65 KB)
**Booking Confirmation Page**

Success page shown after customer submits booking. Displays:
- Booking confirmation message
- Queue position assigned
- Estimated wait time
- Customer's vehicle details
- Next steps and contact information

**UX Highlights:**
- Clear visual feedback on successful submission
- Real-time queue position information
- Professional, reassuring design

---

### 03-dashboard-queue.png (9.8 KB)
**Receptionist Dashboard - Queue Management**

The main queue management interface for receptionists. Features:
- Real-time queue table with all bookings
- Status badges (Queued, In Service, Done, Cancelled)
- Move Up/Down buttons for position reordering
- Status update controls (one-tap actions)
- Shop status toggle (open/closed)
- 10-second polling for live updates

**Key Capabilities:**
- Transaction-safe position updates (SERIALIZABLE isolation)
- Batch operations support
- Estimated wait time calculation
- Cancellation with preset reasons

---

### 04-magic-links.png (9.8 KB)
**Magic Link Generation UI**

Interface for generating new booking magic links. Shows:
- Magic link creation form
- QR code generation
- Active/expired link management
- Copy-to-clipboard functionality
- Link expiration tracking (24 hours)

**Technical Details:**
- Cryptographically secure tokens (128 characters)
- Single-use enforcement
- Automatic cleanup of expired links
- Receptionist-only access (authenticated)

---

## Technical Specifications

**Frontend:**
- Next.js 14 (App Router, React Server Components)
- React 19.2.0
- TypeScript 5 (strict mode)
- TailwindCSS v4

**Backend:**
- Next.js API Routes (serverless)
- PostgreSQL (NeonDB compatible)
- Session-based authentication (Passport.js)
- bcrypt password hashing (cost 12)

**Security:**
- 94/100 security audit score (EXCELLENT)
- Zero P0 vulnerabilities
- 100% parameterized SQL queries
- OWASP Top 10 compliance
- Rate limiting on auth endpoints

**Testing:**
- 130/130 tests passing (100%)
- Vitest + pg-mem (in-memory PostgreSQL)
- ~80% functional path coverage

**Analytics:**
- GoatCounter (privacy-friendly, cookieless, GDPR-compliant)

---

## Use Cases for Portfolio

These screenshots demonstrate:

1. **Full-Stack Development** - Next.js frontend + API routes + PostgreSQL backend
2. **Real-Time Updates** - Client-side polling with 10s refresh (upgradeable to WebSocket)
3. **Mobile-First Design** - Tablet-optimized responsive UI with TailwindCSS
4. **Authentication & Security** - Session management, rate limiting, secure password hashing
5. **Database Expertise** - Complex queries, transactions, foreign keys, indexed performance
6. **Testing Rigor** - 130 comprehensive tests, 100% pass rate
7. **Production Quality** - Security audit passed, quality review 95/100
8. **Real Business Value** - Solves actual pain point for local car wash client

---

## Project Repository

**Location:** `/home/ltpt420/repos/washboard/washboard-app`
**Documentation:** `CLAUDE.md` (905 lines, comprehensive)
**Tests:** `src/__tests__/` (7 files, 130 tests)
**Database:** `src/lib/schema.sql` (6 tables, migrations ready)

---

**Generated:** 2025-11-09
**Purpose:** Professional web development portfolio gallery
**Client:** Local car wash proprietor (real business)
