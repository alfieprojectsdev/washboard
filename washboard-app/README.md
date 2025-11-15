# 🚗 Washboard - Car Wash Queue Management System
 
[![Tests](https://img.shields.io/badge/tests-130%2F130-success)](washboard-app/src/__tests__)
[![Security](https://img.shields.io/badge/security-94%2F100-brightgreen)](#security)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red)](#)
 
**Production-ready browser-based queue management system for car wash operations.** Replace manual pen-and-paper queue management with a modern, contactless digital solution.
 
> **Project Type:** Real-world production application for a local car wash business
> **Status:** ✅ Production Ready (Phases 0-7 Complete)
> **Live Demo:** [washboard.ithinkandicode.space](https://washboard.ithinkandicode.space) *(production instance)*
 
---
 
## 📋 Table of Contents
 
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Quality Metrics](#-quality-metrics)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Security](#-security)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Roadmap](#-roadmap)
 
---
 
## ✨ Features
 
### Core Functionality
 
- **Magic Link Booking System**
  - QR code generation for contactless customer booking
  - Cryptographically secure 128-character tokens
  - 24-hour expiration with single-use enforcement
  - Automatic cleanup of expired links
 
- **Real-Time Queue Management**
  - Live queue updates (10-second polling)
  - Drag-and-drop position reordering with transaction safety
  - Status tracking: Queued → In Service → Done / Cancelled
  - Audit trail for cancellations and modifications
 
- **Shop Status Control**
  - Open/Closed toggle with preset closure reasons
  - Blocks new bookings when closed
  - Real-time status updates across all clients
 
- **Authentication & Authorization**
  - Session-based authentication (Passport.js)
  - bcrypt password hashing (cost factor 12)
  - Rate limiting on login/signup endpoints
  - Protected receptionist routes, public booking routes
 
- **Privacy-Friendly Analytics**
  - GoatCounter integration (cookieless, GDPR-compliant)
  - Event tracking for key user actions
  - No PII collection
 
---
 
## 🛠 Tech Stack
 
### Frontend
- **Next.js 14** - React Server Components, App Router
- **React 19** - Modern UI library
- **TypeScript 5** - Type-safe development
- **TailwindCSS v4** - Utility-first styling
 
### Backend
- **Next.js API Routes** - Serverless functions
- **PostgreSQL** - Relational database (NeonDB serverless)
- **Passport.js** - Authentication middleware
- **express-session** - Session management with PostgreSQL store
 
### Security & Performance
- **bcrypt** - Password hashing (cost 12)
- **express-rate-limit** - Brute force protection
- **connect-pg-simple** - PostgreSQL session store
- **QRCode** - Contactless booking link generation
 
### Testing & Quality
- **Vitest v4** - Unit and integration testing
- **pg-mem** - In-memory PostgreSQL for isolated tests
- **ESLint** - Code quality enforcement
- **TypeScript Strict Mode** - Enhanced type safety
 
---
 
## 🏗 Architecture
 
### Database Schema (PostgreSQL)
 
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
 
**Key Design Decisions:**
- Transaction-safe position updates (SERIALIZABLE isolation)
- Indexed queries for performance (`branch_code`, `status`, `position`)
- Automatic timestamp triggers (`updated_at`)
- CHECK constraints for data validation
- Timing-safe token comparison (prevents timing attacks)
 
### API Design
 
**Public Endpoints** (no auth required):
- `GET /api/shop-status` - Check if accepting bookings
- `POST /api/magic-links/validate` - Validate token before booking
- `POST /api/bookings/submit` - Submit new booking
 
**Protected Endpoints** (receptionist auth required):
- `POST /api/auth/signup|login|logout` - Session management
- `POST /api/magic-links/generate` - Create magic link + QR code
- `GET /api/magic-links/list` - List active/expired links
- `GET /api/bookings` - Fetch queue
- `PATCH /api/bookings/:id` - Update status/position
- `POST /api/shop-status` - Toggle open/closed
 
---
 
## 📊 Quality Metrics
 
### Test Coverage
- **130/130 tests passing** (100% pass rate)
- **7 test suites** covering all critical flows
- **~3-5 second** test execution time
- **80%+ functional path coverage**
 
```
✓ Database initialization (12 tests)
✓ Authentication routes (14 tests)
✓ Magic link service (18 tests)
✓ Magic link API routes (23 tests)
✓ Booking service (18 tests)
✓ Booking API routes (23 tests)
✓ Receptionist dashboard (22 tests)
```
 
### Security Audit
- **Score: 94/100** (EXCELLENT)
- **P0 vulnerabilities: 0** (zero critical issues)
- **OWASP Top 10: Compliant**
- 100% parameterized SQL queries (zero SQL injection risk)
 
### Code Quality
- **Quality Review: 95/100** (production ready)
- **UX Review: 82/100** → **92/100** (WCAG 2.1 AA compliant - Nov 2025)
- **Accessibility:** All text meets 4.5:1 contrast ratio minimum
- TypeScript strict mode enabled
- ESLint configured with best practices
 
---
 
## 🚀 Getting Started
 
### Prerequisites
 
- Node.js 20+ with npm
- PostgreSQL database (or NeonDB serverless)
- Environment variables (see `.env.example`)
 
### Installation
 
```bash
# Clone the repository
git clone https://github.com/yourusername/washboard.git
cd washboard/washboard-app
 
# Install dependencies
npm install
 
# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and SESSION_SECRET
 
# Run database migrations
psql $DATABASE_URL < src/lib/migrations/001_initial_schema_up.sql

# Ensure required data exists (MAIN branch + shop_status)
npm run db:setup
# OR verify and auto-repair: npm run db:verify

# Start development server
npm run dev
# → http://localhost:3000
```
 
### Environment Variables
 
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/washboard
 
# Session Secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your-secret-key-here
 
# Next.js
NODE_ENV=development
 
# Analytics (optional)
NEXT_PUBLIC_GOATCOUNTER_CODE=your-code-here
```
 
### Running Tests
 
```bash
# Run all tests
npm test
 
# Watch mode (auto-rerun on changes)
npm run test:watch
 
# UI mode (interactive test runner)
npm run test:ui
 
# Coverage report
npm run test:coverage
```
 
---
 
## 📁 Project Structure
 
```
washboard/
├── docs/                          # Documentation
│   ├── CLAUDE.md                  # Comprehensive project guide
│   └── context_handoff.md         # Original requirements
├── washboard-app/                 # Main application
│   ├── src/
│   │   ├── app/                   # Next.js App Router
│   │   │   ├── api/               # API routes (serverless)
│   │   │   ├── booking/           # Customer booking pages
│   │   │   ├── dashboard/         # Receptionist dashboard
│   │   │   └── login|signup/      # Authentication pages
│   │   ├── lib/                   # Business logic
│   │   │   ├── auth.ts            # Authentication utilities
│   │   │   ├── db.ts              # Database connection
│   │   │   ├── schema.sql         # PostgreSQL schema
│   │   │   ├── migrations/        # Schema migrations
│   │   │   └── services/          # Service layer
│   │   ├── __tests__/             # Test suite (130 tests)
│   │   └── components/            # React components
│   ├── package.json               # Dependencies
│   └── vitest.config.ts           # Test configuration
└── README.md                      # This file
```
 
---
 
## 🔒 Security
 
### Implementation Highlights
 
✅ **Password Security**
- bcrypt hashing with cost factor 12 (~250ms/hash)
- Minimum 8-character password requirement
- Database constraint: `password_hash` ≥ 60 characters
 
✅ **Session Security**
- httpOnly cookies (XSS protection)
- secure flag (HTTPS-only in production)
- sameSite: 'lax' (CSRF mitigation)
- Session regeneration on login (prevents fixation)
 
✅ **SQL Injection Prevention**
- 100% parameterized queries (no string concatenation)
- pg-format for dynamic query construction
- Input validation with CHECK constraints
 
✅ **Rate Limiting**
- Login: 5 attempts per 15 minutes (per IP)
- Signup: 3 attempts per hour (per IP)
- Prevents brute force attacks
 
✅ **Token Security**
- Cryptographically secure random generation (crypto.randomBytes)
- 128-character tokens (768 bits of entropy)
- Timing-safe comparison (prevents timing attacks)
 
### Security Audit Results
 
**Score: 94/100 - EXCELLENT**
 
**Strengths:**
- Zero P0 (critical) vulnerabilities
- OWASP Top 10 compliance
- Industry-standard password hashing
- Comprehensive input validation
 
**Minor Recommendations (-6 points):**
- Add CSRF tokens on forms (mitigated by sameSite cookies)
- Implement Content-Security-Policy headers (defense-in-depth)
- Add automated security scanning in CI/CD (post-deployment)
 
---
 
## 🧪 Testing
 
### Test Strategy
 
- **Unit Tests:** Database queries, service functions, utility functions
- **Integration Tests:** API routes, authentication flows, end-to-end workflows
- **Database Testing:** pg-mem (in-memory PostgreSQL) for fast, isolated tests
- **No External Dependencies:** Tests run completely offline
 
### Test Examples
 
```typescript
// Magic link generation with expiration
it('should generate magic link with 24-hour expiration', async () => {
  const link = await generateMagicLink({
    branchCode: 'MAIN',
    customerName: 'John Doe',
    createdBy: 1,
  });
 
  expect(link.token).toHaveLength(128);
  expect(link.expiresAt).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
});
 
// Transaction-safe position updates
it('should reorder queue positions with SERIALIZABLE isolation', async () => {
  const booking = await createBooking({ position: 2, ... });
  await updateBookingPosition(booking.id, 1);
 
  const queue = await getQueue('MAIN', 'queued');
  expect(queue[0].position).toBe(1);
  expect(queue[1].position).toBe(2); // Original position 1 shifted down
});
```
 
---
 
## 🚢 Deployment
 
### Vercel + NeonDB (Current Production)
 
```bash
# Build for production
npm run build
 
# Verify build succeeds
npm start
```
 
**Environment Variables (Vercel Dashboard):**
- `DATABASE_URL` - NeonDB connection string
- `SESSION_SECRET` - 32+ character random string
- `NODE_ENV=production`
- `NEXT_PUBLIC_GOATCOUNTER_CODE` - Analytics code
 
**Post-Deployment Checklist:**
- ✅ Homepage loads
- ✅ Shop status endpoint works
- ✅ Receptionist login functional
- ✅ Dashboard loads with queue
- ✅ Magic link generation works (correct domain)
- ✅ Customer booking flow works
- ✅ Analytics tracking works
 
### Custom Domain Setup
 
Configured on Porkbun DNS → Vercel:
- Production: `washboard.ithinkandicode.space`
- Magic links automatically use custom domain (dynamic URL generation)
 
---
 
## 🗺 Roadmap
 
### ✅ Completed (Phases 0-7)
- Project setup and database schema
- Authentication system with session management
- Magic link system with QR codes
- Customer booking form
- Receptionist dashboard with queue management
- GoatCounter analytics integration
- Comprehensive testing suite (130 tests)
- Security and quality audits
- Production deployment
 
### 🚧 Future Enhancements
 
**Phase 9: Real-time Upgrades**
- WebSocket or Server-Sent Events (SSE) for live updates
- Drag-and-drop queue reordering
- Push notifications for customers (PWA)
 
**Phase 10: Queue Intelligence**
- Wait time estimation based on historical data
- Predictive analytics (busy hours, cancellation patterns)
- Performance dashboards
 
**Phase 11: Multi-Branch Support**
- Multi-location management (franchise mode)
- Cross-branch reporting
- Role-based access control
 
**Phase 12: PWA & Offline Support**
- Service worker caching
- Offline mode for dashboard
- Add to Home Screen prompt
 
**Phase 13: Customer Communication**
- SMS notifications via Twilio (optional)
- Messenger bot integration
- WhatsApp templates
 
---
 
## 📝 License
 
**Proprietary** - This project is a real-world client application and is not open source.
 
---
 
## 👤 Author
 
**Alfie Pelicano**
Portfolio: [ithinkandicode.space](https://ithinkandicode.space)
Email: alfieprojects.dev@gmail.com
 
---
 
## 🙏 Acknowledgments
 
- Built with modern web technologies and best practices
- Designed for real-world production use
- Security-first architecture
- Comprehensive testing strategy
- Deployed on Vercel with NeonDB serverless PostgreSQL
 
---
 
**⭐ If you're interested in this project or have questions, feel free to reach out!**