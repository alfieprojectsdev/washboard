<!-- copied from claude-config/coordination/project-status/washboard-status.md -->
# Washboard Project Status

**Project:** washboard (Car Wash Queue Management)
**Location:** `/home/ltpt420/repos/washboard/`
**Last Updated:** 2025-11-06 22:28 UTC
**Active Instances:** 0 (planning/documentation phase)

---

## Current Status

**Overall Health:** 🟢 **PLANNING COMPLETE - READY FOR IMPLEMENTATION**

**Purpose:** Web app for managing car wash queue system (replacing pen-and-paper)

**Current Progress:** Comprehensive context handoff documentation complete

---

## Project Overview

A browser-based queue management system for a local car wash business. Customers can submit their vehicle details and preferred schedule via a web form; receptionists manage the queue through a tablet interface.

**Problem:** Current manual pen-and-paper system is inefficient
**Solution:** Lightweight web app with Wi-Fi connectivity (SMS-based system rejected by proprietor)
**Value:** Actually useful system + portfolio piece + networking tool for web dev opportunities

---

## Business Context

**Client:** Local car wash proprietor
**Users:**
- Customers (submit bookings)
- Receptionist (manage queue via tablet)

**Requirements:**
- NO SMS-based system (proprietor constraint)
- Wi-Fi available on-site
- Tablet-friendly UI for receptionist
- Real-time queue updates
- Queue control (reject/cancel/pause)

**Revenue Model:** Not specified (likely free for client, portfolio value for Alfie)

---

## Technology Stack

**Frontend:**
- Next.js (App Router)
- TailwindCSS

**Backend:**
- Next.js API Routes
- PostgreSQL (NeonDB)

**Real-time:**
- Client-side polling (30-60s intervals)
- Upgradeable to WebSocket/SSE later

---

## Core Features (MVP)

### 1. Customer Booking Form
- Vehicle make, model, plate number
- Optional Messenger contact link
- Preferred schedule/time
- Submits to backend → auto-enqueued

### 2. Receptionist Dashboard
- Display queued vehicles with status
- Update status: Queued → In Progress → Done → Cancelled
- Estimated wait times
- Close shop for new bookings (maintenance, outages, holidays)

### 3. Queue Management
- Auto-ordering by preferred_time or creation timestamp
- Dynamic status badges
- Individual booking cancellation with reasons

### 4. Shop Closure Control
- Toggle: 🟢 Accepting Cars / 🔴 Closed for New Cars
- Preset closure reasons:
  - Full queue / No slots
  - Under maintenance
  - Power outage
  - Water supply issue
  - Staff shortage
  - Weather interruption
  - Closed early
  - Holiday / Special event

---

## Database Schema

### Tables:

**users** (receptionists)
- id, username, role, etc.

**bookings**
- id, plate, vehicle_make, vehicle_model
- preferred_time, contact_messenger
- status (queued | in_progress | done | cancelled)
- cancelled_reason, cancelled_by, cancelled_at
- created_at, updated_at

**shop_status**
- id, is_open (boolean)
- reason (text)
- updated_by, updated_at

---

## API Endpoints

**Public:**
- `GET /api/shop-status` - Check if accepting bookings
- `POST /api/bookings` - Submit new booking

**Receptionist (authenticated):**
- `POST /api/shop-status` - Update shop open/closed state
- `POST /api/reopen-shop` - Reopen for bookings
- `GET /api/bookings` - List bookings by status
- `PATCH /api/bookings/:id/status` - Update booking status
- `POST /api/cancel-booking` - Cancel specific booking with reason

---

## Polling Strategy

**Customer UI:**
- Poll `/api/shop-status` every 30-60s

**Receptionist UI:**
- Poll `/api/bookings` every 10-15s

**Load:** Low (NeonDB-friendly)
**Future:** Upgrade to WebSocket/SSE for true real-time

---

## UX Principles

- **Receptionist tasks:** One tap maximum
- **Customer feedback:** Immediate and clear
- **Minimize typing:** Dropdowns and preset templates
- **Wi-Fi resilience:** Usable on weak/intermittent connections

---

## Documentation

**Primary Document:** `docs/context_handoff.md` (7,028 bytes)
- Created: 2025-11-03
- Comprehensive spec with API endpoints, database schema, system flows

**Earlier Draft:** `docs/Car Wash Queuing System Web App.md` (7,492 bytes)
- Created: 2025-11-02
- Initial conceptualization

---

## Git Status

**Repository:** Local only (no remote yet)
**Branch:** main (assumed)
**Status:** Documentation phase, no code yet

---

## Future Enhancements (Optional)

### Phase 2: Real-time Upgrades
- WebSocket or SSE for live updates
- Drag-and-drop queue reordering
- One-tap Messenger integration

### Phase 3: Queue Intelligence
- Wait-time estimation and forecasting
- Cancellation/outage analytics
- Daily/weekly performance dashboards

### Phase 4: Multi-Branch Support
- Multi-location management
- Role-based access (Admin, Receptionist, Cashier, Washer crew)

### Phase 5: PWA
- Offline caching
- Add to Home Screen
- Push notifications

### Phase 6: Communication
- Messenger templates
- SMS via Twilio
- Loyalty program for repeat customers

---

## Next Steps

**Immediate:**
1. [ ] Create git repository and push to GitHub
2. [ ] Initialize Next.js project
3. [ ] Set up NeonDB database
4. [ ] Create CLAUDE.md with implementation guidance

**Phase 1 (MVP - 1-2 weeks):**
- [ ] Database schema and migrations
- [ ] Customer booking form
- [ ] Receptionist dashboard
- [ ] Basic queue management
- [ ] Shop status control
- [ ] Authentication for receptionist

**Phase 2 (Testing - 1 week):**
- [ ] Beta testing with client
- [ ] UX refinements
- [ ] Bug fixes
- [ ] Performance optimization

**Phase 3 (Deployment):**
- [ ] Deploy to Vercel
- [ ] Connect to production NeonDB
- [ ] Train receptionist on tablet usage
- [ ] Monitor and iterate

---

## Coordination with Root Instance

**Project Priority:** Medium-High (real client, portfolio value)
**Blocking:** None
**Dependencies:** None

**Similar Projects:**
- **Carpool App:** Similar queue/booking patterns
- **PipetGo:** Similar B2B workflow patterns
- **Parkboard:** Similar slot management patterns

**Reusable Patterns:**
- Authentication (from carpool-app)
- Real-time polling (from parkboard Phase 4)
- Status badge UI (from pipetgo)
- GoatCounter analytics (cross-project standard)

**Escalation Triggers:**
- Authentication strategy decisions
- Real-time implementation choices
- Deployment/hosting issues

---

**Status:** Planning complete, ready for implementation
**Next Milestone:** Initialize Next.js project and begin Phase 1 development
**Portfolio Value:** High (real client, actual business problem solved)
