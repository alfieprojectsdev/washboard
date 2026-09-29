// The migration runner that Vercel's production build runs
// (scripts/migrate.mjs + scripts/migrate-core.mjs). The other tests apply the
// SQL files directly (src/__tests__/helpers/test-db.ts), so without these
// nothing checks the bookkeeping, the failure handling or the production-only
// gate.
//
// What no local test can check is how a migration behaves on production's
// rows; that is the Neon branch dry run in docs/PRODUCTION_READINESS.md.

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS_DIR } from '../../../scripts/migrate-core.mjs';

const CLI = path.join(process.cwd(), 'scripts', 'migrate.mjs');
const FILES = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
const tmp = mkdtempSync(path.join(os.tmpdir(), 'washboard-migrate-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// node-pg runs text without parameters over the simple query protocol, which
// accepts a whole multi-statement file in one call; PGlite needs exec() for that.
const asPgClient = (db: PGlite) => ({
  query: async (text: string, params?: unknown[]) =>
    params ? db.query(text, params) : ((await db.exec(text)).at(-1) ?? { rows: [] }),
});

let db: PGlite;
let lines: string[];
const quiet = () => ({ log: (l: string) => lines.push(l), logError: (l: string) => lines.push(l) });
const run = (options: { dir?: string; statusOnly?: boolean } = {}) => migrate(asPgClient(db), { ...quiet(), ...options });
const recorded = async () =>
  (await db.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name')).rows.map((r) => r.name);
const exists = async (table: string) =>
  (await db.query<{ t: string | null }>('SELECT to_regclass($1)::text AS t', [table])).rows[0].t !== null;

describe('migrate()', () => {
  beforeEach(async () => {
    db = await PGlite.create();
    lines = [];
  });
  afterEach(() => db.close());

  it('applies every migration to an empty database and records each one', async () => {
    expect(await run()).toBe(true);
    expect(await recorded()).toEqual(FILES);
    expect(await exists('bookings')).toBe(true);
    expect(await exists('account_tokens')).toBe(true);
    expect(lines).toEqual(FILES.map((f) => `  ran      ${f}`));
  });

  it('does nothing on a second run', async () => {
    await run();
    lines = [];
    expect(await run()).toBe(true);
    expect(lines).toEqual(FILES.map((f) => `  applied  ${f}`));
  });

  it('--status lists pending migrations and changes nothing', async () => {
    expect(await run({ statusOnly: true })).toBe(true);
    expect(lines).toEqual(FILES.map((f) => `  pending  ${f}`));
    expect(await recorded()).toEqual([]);
    expect(await exists('bookings')).toBe(false);
  });

  it('stops at a failing migration, rolls it back and records only what ran', async () => {
    const dir = mkdtempSync(path.join(tmp, 'bad-'));
    writeFileSync(path.join(dir, '001_ok.sql'), 'CREATE TABLE ok_table (id int);');
    writeFileSync(path.join(dir, '002_bad.sql'), 'CREATE TABLE half_done (id int); SELECT * FROM no_such_table;');
    writeFileSync(path.join(dir, '003_later.sql'), 'CREATE TABLE later (id int);');

    expect(await run({ dir })).toBe(false);
    expect(await recorded()).toEqual(['001_ok.sql']);
    expect(await exists('ok_table')).toBe(true);
    expect(await exists('half_done')).toBe(false);
    expect(await exists('later')).toBe(false);
    expect(lines.at(-1)).toMatch(/FAILED {3}002_bad\.sql: .*no_such_table/);
  });

  // The kind of failure only production's rows can cause, which is why a new
  // migration gets a Neon branch dry run: 002's unique index on
  // bookings(magic_link_id) cannot be built while two bookings share a link.
  it('fails 002 on a database that already has a duplicated booking', async () => {
    const only001 = mkdtempSync(path.join(tmp, 'only001-'));
    copyFileSync(path.join(MIGRATIONS_DIR, FILES[0]), path.join(only001, FILES[0]));
    expect(await run({ dir: only001 })).toBe(true);

    await db.exec(`
      INSERT INTO users (branch_code, username, password_hash, name)
        VALUES ('MAIN', 'dup_check', '${'$2b$12$'.padEnd(60, 'x')}', 'Dup Check');
      INSERT INTO customer_magic_links (branch_code, token, expires_at, created_by)
        SELECT 'MAIN', repeat('t', 128), NOW() + INTERVAL '1 day', user_id FROM users WHERE username = 'dup_check';
      INSERT INTO bookings (branch_code, magic_link_id, plate, vehicle_make, vehicle_model, position)
        SELECT 'MAIN', id, plate, 'Toyota', 'Vios', pos
        FROM customer_magic_links, (VALUES ('ABC123', 1), ('ABC124', 2)) AS b(plate, pos);
    `);

    lines = [];
    expect(await run()).toBe(false);
    expect(await recorded()).toEqual([FILES[0]]);
    expect(await exists('feedback')).toBe(false);
    expect(lines.at(-1)).toMatch(/FAILED {3}002_.*\.sql: .*idx_bookings_one_per_magic_link/);
  });
});

describe('scripts/migrate.mjs (the build step)', () => {
  // Run from a temp dir with no inherited DATABASE_URL or VERCEL_ENV, so a
  // developer's own settings can never reach a real database from a test.
  const cli = (args: string[], env: Record<string, string>) => {
    const base = { ...process.env };
    delete base.DATABASE_URL;
    delete base.VERCEL_ENV;
    return spawnSync(process.execPath, [CLI, ...args], { cwd: tmp, env: { ...base, ...env }, encoding: 'utf8', timeout: 20000 });
  };
  const unreachable = 'postgres://nobody@127.0.0.1:1/none';

  it('skips outside a Vercel production build', () => {
    const envs: Record<string, string>[] = [{}, { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }];
    for (const env of envs) {
      const result = cli(['--vercel'], { ...env, DATABASE_URL: unreachable });
      expect(result.status, JSON.stringify(env)).toBe(0);
      expect(result.stdout).toContain('skipped');
    }
  });

  it('fails a production build when DATABASE_URL is missing', () => {
    const result = cli(['--vercel'], { VERCEL_ENV: 'production', DATABASE_URL: '' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('DATABASE_URL is not set');
  });

  it('fails a production build when the database is unreachable', () => {
    const result = cli(['--vercel'], { VERCEL_ENV: 'production', DATABASE_URL: unreachable });
    expect(result.status).not.toBe(0);
  });
});
