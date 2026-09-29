// Applies pending SQL migrations from src/lib/migrations/. Used by
// scripts/migrate.mjs (the command Vercel's build runs) and by
// src/__tests__/database/migrate.test.ts, which passes an in-memory PGlite client.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'migrations');

/**
 * Runs each pending file in filename order, in its own transaction, and
 * records it in schema_migrations. Stops at the first failure. `client` needs
 * node-pg's query(text, params?), which runs a multi-statement file in one
 * call. Returns false if a migration failed.
 *
 * Files are written to be re-runnable, so applying 001 to the database that
 * already has the November 2025 schema is a no-op.
 */
export async function migrate(
  client,
  { dir = MIGRATIONS_DIR, statusOnly = false, log = console.log, logError = console.error } = {}
) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));

  for (const file of readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort()) {
    if (applied.has(file)) {
      log(`  applied  ${file}`);
      continue;
    }
    if (statusOnly) {
      log(`  pending  ${file}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log(`  ran      ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      logError(`  FAILED   ${file}: ${err.message}`);
      return false;
    }
  }
  return true;
}
