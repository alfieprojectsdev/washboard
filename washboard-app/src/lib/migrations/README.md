# Database migrations

Numbered SQL files applied in order by `scripts/migrate.mjs`, which records
each one in the `schema_migrations` table. Every file is written to be safe to
re-run (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `ON CONFLICT DO NOTHING`).

| File | What it does |
|------|--------------|
| `001_initial_schema.sql` | Tables from the November 2025 launch. Re-running it on the production database changes nothing. |
| `002_feedback_and_queue_integrity.sql` | `feedback` table; unique index so a magic link can create at most one booking. |

## Apply

```bash
# from washboard-app/
DATABASE_URL="postgres://…" npm run db:migrate            # apply pending
DATABASE_URL="postgres://…" npm run db:migrate -- --status
```

Or put `DATABASE_URL` in `.env.local` and run
`node --env-file=.env.local scripts/migrate.mjs`. No `psql` needed.

Apply migrations **before** deploying code that depends on them. For 002 that
means: run the migration, then merge/deploy.

## Tests

The test suite applies these same files to PGlite (Postgres compiled to WASM)
for every test file, so a migration that doesn't parse or violates its own
constraints fails `npm test`.

## Rolling back

`down/001_initial_schema_down.sql` drops every table and **deletes all data**.
There is no down file for 002; to undo it, `DROP TABLE feedback` and
`DROP INDEX idx_bookings_one_per_magic_link`.
