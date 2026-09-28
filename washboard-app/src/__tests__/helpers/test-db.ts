// Test stand-in for src/lib/db.ts (wired up by the alias in vitest.config.ts).
//
// PGlite is Postgres compiled to WASM, so tests run the real migration files
// with every constraint, trigger and ON CONFLICT clause intact. It has a single
// connection, so this shim serialises access with a mutex: pool.query() waits
// its turn, and pool.connect() holds the connection until release(). That is
// the behaviour of a one-connection pg Pool, which keeps BEGIN/COMMIT blocks
// from interleaving when a test fires requests concurrently.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PoolClient, QueryResult } from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'lib', 'migrations');

// Match node-postgres: int8 (e.g. BIGSERIAL ids, COUNT(*)) and numeric come back as strings.
const pglite = new PGlite({
  parsers: {
    20: (value: string) => value,
    1700: (value: string) => value,
  },
});

const ready = (async () => {
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort()) {
    await pglite.exec(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
})();

let queue: Promise<void> = Promise.resolve();

function lock(): Promise<() => void> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => (release = resolve));
  const acquired = queue.then(() => release);
  queue = queue.then(() => next);
  return acquired;
}

async function run(text: string, params?: unknown[]): Promise<QueryResult> {
  await ready;
  const result = await pglite.query(text, params as unknown[]);
  return {
    rows: result.rows as QueryResult['rows'],
    rowCount: result.affectedRows ? result.affectedRows : result.rows.length,
    fields: result.fields as unknown as QueryResult['fields'],
    command: '',
    oid: 0,
  };
}

const db = {
  async query(text: string, params?: unknown[]) {
    const release = await lock();
    try {
      return await run(text, params);
    } finally {
      release();
    }
  },
  async connect() {
    const release = await lock();
    let released = false;
    return {
      query: run,
      release: () => {
        if (!released) {
          released = true;
          release();
        }
      },
    } as unknown as PoolClient;
  },
  async end() {},
  on() {},
};

export default db;

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  return db.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return db.connect();
}

export async function closePool(): Promise<void> {}
