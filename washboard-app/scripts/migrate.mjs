#!/usr/bin/env node
// Apply pending SQL migrations from src/lib/migrations/ in filename order.
//
//   DATABASE_URL=postgres://... node scripts/migrate.mjs            apply pending
//   DATABASE_URL=postgres://... node scripts/migrate.mjs --status   list, change nothing
//   node --env-file=.env.local scripts/migrate.mjs                  read URL from a file
//   node scripts/migrate.mjs --vercel                               used by `npm run build`
//
// With --vercel it only runs when Vercel is building Production
// (VERCEL_ENV=production), so merging to main applies pending migrations
// before the new code goes live. If a migration fails, the build fails and
// the previous deployment stays up. Local, CI and preview builds skip it, so
// a pull request can never change the production database.
//
// Each file runs in its own transaction and is recorded in schema_migrations.
// Files are written to be re-runnable, so applying 001 to the database that
// already has the November 2025 schema is a no-op.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'migrations');
const statusOnly = process.argv.includes('--status');

if (process.argv.includes('--vercel') && process.env.VERCEL_ENV !== 'production') {
  console.log('migrate: skipped (not a Vercel production build)');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const files = (await readdir(dir)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  applied  ${file}`);
      continue;
    }
    if (statusOnly) {
      console.log(`  pending  ${file}`);
      continue;
    }
    const sql = await readFile(path.join(dir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  ran      ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAILED   ${file}: ${err.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
