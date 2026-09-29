// src/lib/db.ts
// Shared PostgreSQL pool (Neon in production).
//
// Tests never load this file: vitest.config.ts aliases '@/lib/db' to
// src/__tests__/helpers/test-db.ts, which runs the same SQL against PGlite
// (real Postgres compiled to WASM). Keeping the test database out of this
// module means nothing test-only can end up in the production bundle.
import { Pool, PoolClient, QueryResult } from 'pg';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Serverless functions each hold their own pool, so keep it small; Neon's
  // pooled endpoint (-pooler host) multiplexes the rest.
  max: 5,
  idleTimeoutMillis: 30000,
  // Neon can take several seconds to wake a suspended compute.
  connectionTimeoutMillis: 15000,
});

export default db;

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  return db.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return db.connect();
}

export async function closePool(): Promise<void> {
  await db.end();
}
