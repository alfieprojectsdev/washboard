# 🧼 Car Wash Queue Web App — Context Handoff Document

**Tech Stack:**

* **Frontend:** Next.js (App Router)
* **Backend:** Next.js API Routes + NeonDB (PostgreSQL)
* **UI Framework:** TailwindCSS
* **Realtime:** Client-side polling (upgradeable to WebSocket/SSE)

---

## 🧩 Project Summary

### **What**

A web app for managing a car wash queue system — replacing pen-and-paper lists.
Customers can input their car details and preferred schedule; the receptionist manages the queue via tablet.

### **Why**

* The current system relies on manual writing and verbal updates.
* The proprietor disallows SMS-based systems, but they do have Wi-Fi.
* This app introduces digital queue management using a lightweight, browser-based interface.
* Goal: build an actually useful system (dev pride), while also serving as a **portfolio piece** and **networking tool** for future web dev opportunities.

### **How**

* Next.js frontend + API routes connected to a Neon-hosted Postgres DB.
* Customer UI for queue entry; receptionist dashboard for management.
* Client-side polling for real-time updates.
* Receptionist can reject, cancel, or temporarily close the queue (with predefined reasons).

---

## 🧩 Core Features (MVP)

1. **Customer Booking Form**

   * Vehicle make, model, and plate number.
   * Optional Messenger contact link.
   * Preferred schedule/time input.
   * Submits to backend → enqueued automatically.

2. **Receptionist Dashboard**

   * Displays queued vehicles, statuses, and estimated wait times.
   * Can update status to *In Progress*, *Done*, or *Cancelled*.
   * Can “close” the shop for new bookings (e.g., maintenance, outages, holidays).
   * Status changes reflected near-real-time via polling.

3. **Queue Auto-ordering**

   * Bookings sorted by `preferred_time` or creation timestamp.
   * Dynamic badges: `Queued`, `In Progress`, `Done`, `Cancelled`.

4. **Client Notifications**

   * On-screen status updates.
   * Optional Messenger or email notifications (future enhancement).

---

## 🧩 Queue Control and Cancellation Logic

### **1. Individual Reject / Cancel**

Receptionist can cancel or reject a booking with a reason.

**Preset reasons:**

* Full queue / No available slots
* Under maintenance
* Power outage
* Water supply issue
* Staff shortage
* Weather interruption
* Closed early
* Holiday / Special event

**Schema Additions**

```sql
ALTER TABLE bookings
ADD COLUMN status TEXT DEFAULT 'queued' CHECK (status IN ('queued','in_progress','done','cancelled')),
ADD COLUMN cancelled_reason TEXT,
ADD COLUMN cancelled_by UUID REFERENCES users(id),
ADD COLUMN cancelled_at TIMESTAMPTZ;
```

---

### **2. Shop Closure / Pause**

Receptionist can pause new bookings temporarily.

**UI Behavior:**

* Toggle: 🟢 Accepting Cars / 🔴 Closed for New Cars
* Modal: Select reason from list
* Affects `/api/shop-status`

**Schema:**

```sql
CREATE TABLE shop_status (
  id SERIAL PRIMARY KEY,
  is_open BOOLEAN DEFAULT TRUE,
  reason TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Customer Experience:**

> “Sorry, we’re currently not accepting new washes — Reason: *Power outage*”

---

## 🧩 API Endpoints Summary

### **1. `GET /api/shop-status`**

Returns shop’s open/closed state and reason.
**Public endpoint.**

```json
{ "is_open": true, "reason": null, "updated_at": "2025-11-02T08:45:00Z" }
```

### **2. `POST /api/shop-status`**

Updates shop status (receptionist only).

```json
{ "is_open": false, "reason": "Power outage" }
```

### **3. `POST /api/cancel-booking`**

Cancels a specific booking.

```json
{ "booking_id": 542, "reason": "Water supply issue" }
```

### **4. `POST /api/reopen-shop`**

Shortcut for reopening (sets `is_open: true`).

### **5. `GET /api/bookings`**

Lists bookings filtered by status.
`/api/bookings?status=queued`

### **6. `POST /api/bookings`**

Creates a new booking (customer form).

```json
{
  "plate": "XYZ-5678",
  "vehicle_make": "Toyota",
  "vehicle_model": "Vios",
  "preferred_time": "2025-11-02T10:30:00Z",
  "contact_messenger": "fb.com/johndoe"
}
```

### **7. `PATCH /api/bookings/:id/status`**

Receptionist updates booking status.

```json
{ "status": "done" }
```

---

## 🧩 System Flow Summary

### **Actors**

* **Customer:** Fills queue form.
* **Receptionist:** Manages queue.
* **Server:** Next.js API + NeonDB.

### **Flow Overview**

```
Customer → POST /api/bookings → DB (status=queued)
    ↓
Receptionist polls /api/bookings
    ↓
Status changes → PATCH /api/bookings/:id/status
    ↓
Customer sees live status updates
```

**Cancellations:**

```
Receptionist → POST /api/cancel-booking
    ↓
DB logs reason + timestamp
    ↓
Customer notified → UI badge: “Cancelled: Power outage”
```

**Shop Closure:**

```
Receptionist → POST /api/shop-status (is_open=false)
    ↓
Customer UI disables booking form
    ↓
Displays closure banner with reason
```

---

## 🧩 Data Model Summary

```
users (receptionists)
  └── manages → bookings
bookings
  ├── status (queued | in_progress | done | cancelled)
  ├── cancelled_reason
  └── cancelled_by → users.id
shop_status
  ├── is_open (boolean)
  ├── reason (text)
  └── updated_by → users.id
```

---

## 🧩 Polling & Realtime Strategy

* Customer UI polls `/api/shop-status` every **30–60s**.
* Receptionist UI polls `/api/bookings` every **10–15s**.
* NeonDB load kept low; easily upgraded to WebSocket/SSE later.

---

## 🧩 UX Principles

* Receptionist tasks = one tap max.
* Customer feedback = immediate and clear.
* Minimize typing via dropdowns and prefilled templates.
* Maintain usability even on weak or intermittent Wi-Fi.

---

## 🧩 Future Enhancements (Optional)

### **1. Real-time Interaction Upgrades**

* WebSocket or SSE for true live updates.
* Drag-and-drop queue reordering.
* One-tap Messenger integration for instant status messages.

### **2. Queue Intelligence & Analytics**

* Wait-time estimation and queue length forecasting.
* Cancellation/outage analytics.
* Summary dashboards for daily/weekly performance.

### **3. Multi-Branch & Role Expansion**

* Multi-branch management under one system.
* Role-based access:

  * Admin (branch + staff mgmt)
  * Receptionist (queue control)
  * Cashier (payment tracking)
  * Washer crew (next-car view)

### **4. Progressive Web App (PWA)**

* Offline queue caching and data sync.
* Add to Home Screen support.
* Push notifications for customers and staff.

### **5. Communication & Loyalty**

* Predefined Messenger templates.
* SMS fallback via Twilio/local gateway.
* Loyalty tracker for repeat customers.

### **6. Admin Customization**

* Configurable preset reasons and shop hours.
* Capacity thresholds.
* Optional public API or FB Page plugin integration.

### **7. Developer Enhancements**

* Audit trail for queue actions.
* GraphQL API for analytics.
* CI/CD setup for Neon + Vercel.

---

**End of Document**


