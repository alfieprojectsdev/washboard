import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Schema tests: apply the real migration files to a fresh PGlite database
 * (Postgres compiled to WASM) and check tables, seed data and constraints.
 *
 * Before 2026-09-26 these ran against pg-mem with the CHECK constraints,
 * triggers and ON CONFLICT clauses filtered out of the SQL first, so the
 * constraints below were never actually exercised.
 */

const dir = path.join(process.cwd(), 'src', 'lib', 'migrations');
const migrations = readdirSync(dir)
  .filter((f) => /^\d{3}_.+\.sql$/.test(f))
  .sort()
  .map((f) => readFileSync(path.join(dir, f), 'utf8'));

const HASH = '$2b$10$abcdefghijklmnopqrstuuO3VbCmrfbHqX1bY7n6FhGZ9kqYyWf1bC';

describe('Database schema (migrations)', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    for (const sql of migrations) {
      await db.exec(sql);
    }
  });

  it('can re-run every migration without error (production already has 001)', async () => {
    for (const sql of migrations) {
      await expect(db.exec(sql)).resolves.toBeDefined();
    }
  });

  it.each(['branches', 'users', 'customer_magic_links', 'bookings', 'shop_status', 'sessions', 'rate_limits', 'feedback'])(
    'creates the %s table',
    async (table) => {
      const result = await db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      expect(result.rows).toHaveLength(1);
    }
  );

  it('seeds the MAIN branch, open', async () => {
    const branch = await db.query<{ branch_code: string }>(`SELECT branch_code FROM branches WHERE branch_code = 'MAIN'`);
    expect(branch.rows).toHaveLength(1);
    const status = await db.query<{ is_open: boolean }>(`SELECT is_open FROM shop_status WHERE branch_code = 'MAIN'`);
    expect(status.rows[0].is_open).toBe(true);
  });

  it('rejects an unknown booking status', async () => {
    await expect(
      db.query(`INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
                VALUES ('MAIN', 'X', 'Y', 'Z', 'bogus', 1)`)
    ).rejects.toThrow(/valid_status/);
  });

  it('rejects an unknown role', async () => {
    await expect(
      db.query(`INSERT INTO users (branch_code, username, password_hash, name, role)
                VALUES ('MAIN', 'someone', $1, 'Someone', 'superuser')`, [HASH])
    ).rejects.toThrow(/valid_role/);
  });

  it('rejects a password_hash that is not a bcrypt hash', async () => {
    await expect(
      db.query(`INSERT INTO users (branch_code, username, password_hash, name) VALUES ('MAIN', 'shorthash', 'hash', 'X')`)
    ).rejects.toThrow(/password_length/);
  });

  it('keeps usernames unique per branch', async () => {
    await db.query(`INSERT INTO users (branch_code, username, password_hash, name) VALUES ('MAIN', 'dup', $1, 'A')`, [HASH]);
    await expect(
      db.query(`INSERT INTO users (branch_code, username, password_hash, name) VALUES ('MAIN', 'dup', $1, 'B')`, [HASH])
    ).rejects.toThrow(/idx_users_branch_username/);
  });

  it('allows only one booking per magic link', async () => {
    const user = await db.query<{ user_id: number }>(
      `INSERT INTO users (branch_code, username, password_hash, name) VALUES ('MAIN', 'linkmaker', $1, 'L') RETURNING user_id`,
      [HASH]
    );
    const link = await db.query<{ id: string }>(
      `INSERT INTO customer_magic_links (branch_code, token, expires_at, created_by)
       VALUES ('MAIN', $1, NOW() + INTERVAL '1 day', $2) RETURNING id`,
      ['t'.repeat(128), user.rows[0].user_id]
    );
    const insert = () =>
      db.query(
        `INSERT INTO bookings (branch_code, magic_link_id, plate, vehicle_make, vehicle_model, position)
         VALUES ('MAIN', $1, 'ABC', 'Toyota', 'Vios', 1)`,
        [link.rows[0].id]
      );
    await insert();
    await expect(insert()).rejects.toThrow(/idx_bookings_one_per_magic_link/);
  });

  it('rejects empty and oversized feedback', async () => {
    await expect(db.query(`INSERT INTO feedback (message) VALUES ('')`)).rejects.toThrow(/feedback_message_length/);
    await expect(db.query(`INSERT INTO feedback (message) VALUES ($1)`, ['x'.repeat(2001)])).rejects.toThrow(
      /feedback_message_length/
    );
  });

  it('cascades user deletion when a branch is deleted', async () => {
    await db.query(`INSERT INTO branches (branch_code, branch_name) VALUES ('GONE', 'Temporary')`);
    await db.query(`INSERT INTO users (branch_code, username, password_hash, name) VALUES ('GONE', 'temp', $1, 'T')`, [HASH]);
    await db.query(`DELETE FROM branches WHERE branch_code = 'GONE'`);
    const users = await db.query(`SELECT 1 FROM users WHERE branch_code = 'GONE'`);
    expect(users.rows).toHaveLength(0);
  });
});
