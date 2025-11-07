// src/lib/db.ts
import { Pool, PoolClient, QueryResult } from 'pg';
import fs from 'fs';
import path from 'path';

let db: Pool;

if (process.env.USE_MOCK_DB === 'true') {
  // Import pg-mem dynamically (only when needed)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { newDb } = require('pg-mem');

  const mem = newDb({
    autoCreateForeignKeyIndices: true
  });

  // Load schema if it exists (will be created in Phase 1)
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    mem.public.none(schema);
    console.log('📋 Schema loaded into pg-mem');
  }

  // Create PostgreSQL-compatible adapter
  db = mem.adapters.createPg().Pool as Pool;

  console.log('🧪 Using pg-mem (mock database)');
} else {
  // Real PostgreSQL connection
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });

  console.log('🌐 Using PostgreSQL (DATABASE_URL)');
}

// Export the database instance
export default db;

// Type-safe query helper
export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  return db.query(text, params);
}

// Helper to get a client from the pool
export async function getClient(): Promise<PoolClient> {
  return db.connect();
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  if (process.env.USE_MOCK_DB !== 'true') {
    await db.end();
    console.log('🔌 Database connection pool closed');
  }
}
