## 🧠 Project Context Handoff — Car Wash Queuing System Web App

### 🧩 Summary

A **Next.js + NeonDB (PostgreSQL)** web application to replace a car wash’s **pen-and-paper queue system**.
The goal is to let customers register their vehicle for a wash, while receptionists manage the active queue via a tablet interface — all **without SMS notifications** (per proprietor’s restriction).

Instead, **Messenger contact links** are used for customer follow-up.
Client-side polling ensures near-realtime updates across devices.

---

## 🧱 Core Motivation

**Problem:**
Current workflow = manually writing vehicle details on paper and verbally asking the receptionist to append new entries. This causes confusion, duplicates, and no easy way to track queue order or waiting times.

**Objective:**
Digitize the process into a single lightweight web app that:

* Stores all queue entries centrally in Postgres (NeonDB).
* Updates both client and receptionist views automatically.
* Uses **Facebook Messenger handles** as the primary contact method.

**Constraints:**

* No SMS notifications allowed.
* Shop has Wi-Fi but limited hardware (small tablet used by receptionist).
* Simple, fast, mobile-first UI required.

---

## ⚙️ Tech Stack

| Layer    | Technology                                      | Notes                                    |
| -------- | ----------------------------------------------- | ---------------------------------------- |
| Frontend | **Next.js (App Router)**                        | Client UI + receptionist dashboard       |
| Backend  | **Next.js API routes**                          | Handles CRUD operations for queue items  |
| Database | **NeonDB (PostgreSQL)**                         | Hosted, serverless-compatible            |
| Realtime | **Client-side polling**                         | Every 3–5 seconds                        |
| Auth     | Minimal (password-protected receptionist route) | Public form for customers                |
| Hosting  | **Vercel**                                      | Compatible with Neon serverless Postgres |

---

## 🗄️ Database Schema

```sql
CREATE TABLE queue_items (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  plate TEXT NOT NULL,
  messenger_handle TEXT NOT NULL,
  preferred_start TIMESTAMPTZ,
  preferred_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting',   -- waiting | in_service | done | cancelled
  position INT NOT NULL,                    -- for explicit ordering
  notes TEXT,
  CONSTRAINT valid_messenger CHECK (
    messenger_handle ~* '^(https?:\/\/)?(m\.me|fb\.com)\/[A-Za-z0-9._-]+$'
  )
);

CREATE INDEX idx_queue_status_position
  ON queue_items(status, position);
```

---

## 🔁 Queue Rules

1. New entries appended at the end of the **“waiting”** list.
2. Optional preferred time fields (not yet enforced in scheduling logic).
3. Receptionist can:

   * Mark `in_service`, `done`, or `cancelled`.
   * Move items up/down (reordering updates `position`).
4. Polling updates the receptionist UI every 3 seconds.

---

## 🧮 Estimated Wait Logic

```
estimated_wait_minutes = cars_ahead * avg_service_minutes
```

Default `avg_service_minutes = 20`.
Displayed to customer as “~40 minutes (2 cars ahead)”.

---

## 🔌 API Surface (MVP)

| Method                          | Endpoint                                        | Purpose |
| ------------------------------- | ----------------------------------------------- | ------- |
| `GET /api/queue?status=waiting` | Fetch all waiting items ordered by `position`   |         |
| `POST /api/queue`               | Add a new queue item                            |         |
| `PATCH /api/queue/:id`          | Update status, notes, or position               |         |
| `POST /api/queue/reorder`       | Batch update queue positions (for receptionist) |         |
| `GET /api/queue/:id`            | Fetch single item details (for status tracking) |         |

---

## 🧰 Example Endpoint: `POST /api/queue`

```js
// app/api/queue/route.js (App Router)
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req) {
  const body = await req.json();
  const { make, model, plate, messenger_handle, preferred_start, preferred_end, notes } = body;
  if (!make || !model || !plate || !messenger_handle)
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      "SELECT COALESCE(MAX(position), 0) AS maxpos FROM queue_items WHERE status='waiting' FOR UPDATE"
    );
    const nextPos = r.rows[0].maxpos + 1;

    const insert = `
      INSERT INTO queue_items (make, model, plate, messenger_handle, preferred_start, preferred_end, notes, position)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;
    const vals = [make, model, plate, messenger_handle, preferred_start, preferred_end, notes, nextPos];
    const inserted = await client.query(insert, vals);
    await client.query('COMMIT');
    return new Response(JSON.stringify(inserted.rows[0]), { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 });
  } finally {
    client.release();
  }
}
```

---

## 💻 UI Layout Plan

### Customer View (Public)

* **Fields:** Make, Model, Plate, Messenger Handle, Preferred Time, Notes
* **Action:** Submit → Success screen shows queue position + estimated wait.
* **Polling:** Optional auto-refresh every 10s to update status.

### Receptionist Dashboard (Private)

* Tablet-friendly responsive table
* Columns: Position, Make/Model, Plate, Messenger (clickable icon), Preferred Time, Status, Actions
* Actions: `Start`, `Done`, `Cancel`, `Move Up`, `Move Down`
* Optional: “Message Customer” button linking to:

  ```
  https://m.me/<username>?text=Hi! Your car is next for washing.
  ```

---

## 🔄 Polling Mechanism

Frontend polls `/api/queue?status=waiting` every **3 seconds**.
Response includes `lastServerTs`. If unchanged → skip UI re-render.
This keeps it light without WebSockets.

---

## 🪜 ADHD-Friendly Dev Ladder

| Step | Goal                                    | ETA      |
| ---- | --------------------------------------- | -------- |
| 1    | Create NeonDB + connection string       | #due::1d |
| 2    | Run SQL migration (table + index)       | #due::1d |
| 3    | Scaffold Next.js app + `/api/queue`     | #due::2d |
| 4    | Build public form (customer input)      | #due::1d |
| 5    | Build receptionist queue view + polling | #due::2d |
| 6    | Add reorder + status actions            | #due::1d |
| 7    | Polish UI for tablet use                | #due::1d |
| 8    | Deploy to Vercel + connect Neon         | #due::1d |

---

## 🧩 Future Enhancements (Optional)

* Drag-and-drop queue reordering
* Wait-time analytics
* Messenger message templates
* Multi-branch (if multiple carwash locations)
* Role-based access (admin, cashier, washer view)

---

**Summary:**
This system digitizes a low-tech, high-friction queueing workflow into a simple, tablet-ready web interface with customer-facing entry and live receptionist management — powered by NeonDB, minimal polling, and Messenger links instead of SMS.