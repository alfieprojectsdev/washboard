<!-- aka: claude-config/coordination/ClaudeWebvsLocalClaude_workflow-design.md -->
## 🧭 DEV WORKFLOW SPEC (Prisma + Vitest + `pg-mem` Integration)

### 🎯 Goal

Enable two interchangeable environments:

* **Mocked (pg-mem)** for Claude Web / CI
* **Real Postgres** for local and staging

while maintaining Vitest as your test runner.

---

### ⚙️ Environment Toggle

`.env`

```bash
USE_MOCK_DB=true
DATABASE_URL="postgresql://user:password@localhost:5432/pipetgo_dev"
```

---

### 🧩 Dynamic DB Loader (`src/lib/db.ts`)

```ts
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (process.env.USE_MOCK_DB === 'true') {
  const { newDb } = await import('pg-mem');
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.none(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      email TEXT
    );
    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      clientId INT,
      labId INT,
      status TEXT,
      quotedPrice NUMERIC
    );
  `);

  prisma = new PrismaClient({
    datasources: { db: { url: 'file:mock.db?connection_limit=1' } } // dummy URL
  });

  console.log('🧪 Using in-memory pg-mem database');
} else {
  prisma = new PrismaClient();
  console.log('🧭 Connected to Postgres');
}

export default prisma;
```

---

### 🧪 Test Integration (Vitest)

You already mock Prisma with:

```ts
vi.mock('@/lib/db')
```

You can extend it to load the mock DB layer automatically in test mode:

```ts
import prisma from '@/lib/db'

beforeAll(async () => {
  if (process.env.USE_MOCK_DB === 'true') {
    console.log('🔧 Loading mock pg-mem database for Vitest');
  }
});
```

You don’t need Jest or Supertest — Vitest’s `fetch` mocking and built-in `vi.mock()` system already give you full isolation and parallel test execution.

---

### 🧱 Architecture Recap

| Component      | Tool                | Purpose                              |
| -------------- | ------------------- | ------------------------------------ |
| ORM            | Prisma              | Schema + CRUD abstraction            |
| Test Runner    | Vitest              | Lightweight ESM-compatible testing   |
| Mock DB        | `pg-mem`            | Emulates Postgres behavior in-memory |
| Test Mocks     | `vi.mock()`         | Stubs Prisma client + NextAuth       |
| Future Real DB | Postgres / Supabase | Integration layer for later phases   |

---

### 🧠 Claude Orchestration Hooks

| Environment | DB       | Runner | Purpose                        |
| ----------- | -------- | ------ | ------------------------------ |
| Claude Web  | `pg-mem` | Vitest | No external DBs, low token use |
| Local       | Postgres | Vitest | Real schema and migrations     |
| CI/CD       | `pg-mem` | Vitest | Fast, deterministic test runs  |
| Staging     | Supabase | Vitest | Integration verification       |

---

### 🪜 Setup Ladder (ADHD-friendly version)

1. [ ] Add `USE_MOCK_DB` to `.env`
2. [ ] Update `src/lib/db.ts` to toggle `pg-mem` vs Postgres
3. [ ] Confirm `vi.mock('@/lib/db')` is applied globally in Vitest config
4. [ ] Run mock tests:

   ```bash
   USE_MOCK_DB=true npm run test
   ```
5. [ ] Run real DB tests:

   ```bash
   USE_MOCK_DB=false npm run test
   ```
6. [ ] Verify all 227 tests pass in both modes
7. [ ] (Later) Integrate with Dockerized Postgres for Phase 7

---

### 🧰 Bonus Optimization

* Add a small helper script:

  ```bash
  # scripts/toggle-db.sh
  if [ "$1" == "mock" ]; then
    export USE_MOCK_DB=true && npm run test
  else
    export USE_MOCK_DB=false && npm run test
  fi
  ```

  Then run:

  ```bash
  ./scripts/toggle-db.sh mock
  ./scripts/toggle-db.sh real
  ```

---

## 🧩 Your Development Environment (Synced Assumptions)

### 🖥️ **Local Claude Code**

* **Full Node.js environment** — you can install packages, connect to real Supabase, and run local servers.
* **No compute or runtime constraints** — but **token usage costs you**.
* ✅ Best for: real DB connections, end-to-end testing, final deployment builds.
* ⚠️ Watch for: token-heavy interactions (Claude generating long code or explanations).

---

### ☁️ **Claude Code for the Web (Anthropic Cloud)**

* **Sandboxed environment** — limited network access, no persistent connections to external DBs.
* **$250 free credits for 2 weeks** — essentially free compute tokens for generation and local execution.
* ✅ Best for:

  * Mock DB testing using **`pg-mem`** (purely in-memory, zero network)
  * Iterative endpoint development (Claude writes + tests code quickly)
  * Unit/integration testing that doesn’t need real credentials
* ⚠️ Constraints:

  * Can’t `npm install` dynamically (depends on environment setup).
  * Can’t connect to Supabase, Neon, etc.
  * Can’t persist data between sessions (each execution is ephemeral).

---

### 🧠 **Strategic Goal**

* **Offload token-expensive tasks** (code generation, heavy test iterations, schema design) to **Claude Web**, where you’re on free compute.
* **Keep actual DB connections, installations, and final debugging** on **Claude Local**, where you have stable runtime control but limited token budget.

---

## 🚀 Recommended Split Workflow

| Task                                      | Run On                   | Reason                                 |
| ----------------------------------------- | ------------------------ | -------------------------------------- |
| Designing endpoints / writing boilerplate | Claude Web               | Free tokens + safe mock testing        |
| Testing SQL logic / DB behavior           | Claude Web with `pg-mem` | No need for real DB, fits sandbox      |
| Schema migration / production DB setup    | Local Claude             | Needs real Supabase connection         |
| Dependency installation, builds           | Local Claude             | Full system access                     |
| Stress testing / code refactors           | Claude Web               | Offload CPU + token-heavy AI code runs |
| Final deployment prep                     | Local Claude             | Real runtime parity with production    |

---

## 🧩 Architecture Recommendation

You can design your app like this:

```
/src
  /db
    ├── index.js           ← entrypoint (switches between real + pg-mem)
    ├── schema.sql         ← shared schema for both environments
    ├── mock-seed.sql      ← seed data for pg-mem
  /api
    ├── users.js
    ├── bookings.js
    └── donations.js
```

### `/src/db/index.js`

```js
import fs from "fs";
import { newDb } from "pg-mem";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let db;

if (process.env.MOCK_MODE === "true") {
  const mem = newDb();
  const pg = mem.adapters.createPgPromise();

  const schema = fs.readFileSync("./src/db/schema.sql", "utf8");
  await pg.none(schema);

  const seed = fs.readFileSync("./src/db/mock-seed.sql", "utf8");
  await pg.none(seed);

  console.log("✅ Using pg-mem (mock DB)");
  db = pg;
} else {
  console.log("🌐 Using Supabase (live DB)");
  db = createSupabaseClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

export default db;
```

Then, your route handlers (`users.js`, etc.) only ever import `db` — they don’t care what’s underneath.

That means:

* On **Claude Web** → use `MOCK_MODE=true` and test freely.
* On **Claude Local** → run with real Supabase and cost-efficient small prompts.

---

## ⚡ Bonus Optimization Tips

1. **Token minimization locally**

   * Prompt Claude locally with *short* deltas (“add pagination to this endpoint”) rather than “generate the full API again.”
   * Keep a local cache of your schema and example payloads to avoid repeating them in prompts.

2. **Leverage free compute window**

   * Have Claude Web generate your data seeding scripts, migration files, and test cases.
   * You can even ask it to *stress test* the mock DB logic with random data (since that burns compute, not your tokens).

3. **After the credits expire**

   * Flip workflow back: let Claude Local handle development, but keep the same `pg-mem` mock mode for fast offline tests.

---

## TL;DR (Workflow Summary)

| Mode             | DB       | Token Cost          | Usage                      |
| ---------------- | -------- | ------------------- | -------------------------- |
| Claude Web       | `pg-mem` | Free (uses credits) | Develop, test, refactor    |
| Claude Local     | Supabase | Paid tokens         | Connect to real DB, deploy |
| Fallback Offline | `pg-mem` | Minimal             | Work when Supabase blocked |
