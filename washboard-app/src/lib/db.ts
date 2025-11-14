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
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Filter out pg-mem unsupported features (line by line)
    const lines = schema.split('\n');
    let filteredLines = lines
      .filter(line => !line.trim().startsWith('CREATE EXTENSION'))
      .filter(line => !line.trim().startsWith('COMMENT ON'))
      .filter(line => !line.trim().startsWith('CREATE TRIGGER'))
      .filter(line => !line.trim().startsWith('CREATE OR REPLACE FUNCTION'))
      .filter(line => !line.includes('EXECUTE FUNCTION')) // Trigger references
      .filter(line => !line.includes('RETURNS TRIGGER')) // Function signatures
      .filter(line => !line.includes('LANGUAGE plpgsql')) // Function endings
      .filter(line => !line.includes('TRIGGER AS $$')) // Trigger function start
      .filter(line => {
        const trimmed = line.trim();
        return trimmed !== 'BEGIN' && trimmed !== 'END;' && trimmed !== 'RETURN NEW;';
      })
      .filter(line => !line.includes('NEW.updated_at')) // Trigger body content
      .filter(line => !line.includes('valid_username CHECK')) // Regex constraints
      .filter(line => !line.includes('valid_email CHECK'))
      .filter(line => !line.includes('valid_messenger CHECK'))
      .filter(line => !line.includes('password_length CHECK')) // LENGTH constraint
      .filter(line => !line.includes(' ~* ')) // Regex operator (case-insensitive)
      .filter(line => !line.includes(' ~ ')) // Regex operator (case-sensitive)
      .filter(line => !line.includes('customer_messenger IS NULL OR')); // Orphaned constraint body

    // Remove orphaned closing parentheses (from removed constraints)
    filteredLines = filteredLines.filter((line, index) => {
      const trimmed = line.trim();
      // Skip lines that are just ')' preceded by a column definition
      if (trimmed === ')' && index > 0) {
        const prevLine = filteredLines[index - 1].trim();
        // If previous line doesn't end with comma, this is an orphaned constraint closer
        if (!prevLine.endsWith(',') && !prevLine.endsWith('(')) {
          return false;
        }
      }
      return true;
    });

    schema = filteredLines.join('\n');

    // Clean up trailing commas before closing parentheses (from removed constraints)
    schema = schema.replace(/,(\s*\n\s*\))/g, '$1');

    // Remove ON CONFLICT clauses (pg-mem has limited support)
    schema = schema.replace(/ON CONFLICT[^;]*/gi, '');

    mem.public.none(schema);
    console.log('📋 Schema loaded into pg-mem (filtered for compatibility)');
  }

  // Create PostgreSQL-compatible adapter
  const pgAdapter = mem.adapters.createPg();
  const PoolConstructor = pgAdapter.Pool;
  db = new PoolConstructor() as any;

  console.log('🧪 Using pg-mem (mock database)');
} else {
  // Real PostgreSQL connection
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Connection pool size
    idleTimeoutMillis: 30000,
    // connectionTimeoutMillis: 2000
    connectionTimeoutMillis: 15000 // Alfie: updated manually
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
