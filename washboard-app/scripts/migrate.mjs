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
// The migration logic is in migrate-core.mjs; src/__tests__/database/migrate.test.ts
// covers both files.
import pg from 'pg';
import { migrate } from './migrate-core.mjs';

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
  if (!(await migrate(client, { statusOnly: process.argv.includes('--status') }))) process.exitCode = 1;
} finally {
  await client.end();
}
