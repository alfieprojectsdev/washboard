// src/__tests__/database/schema.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';

describe('Database Schema', () => {
  let db: any;

  beforeAll(async () => {
    // Create pg-mem instance
    db = newDb({ autoCreateForeignKeyIndices: true });

    // Load schema
    const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // pg-mem doesn't support some PostgreSQL features - filter them out
    // We need to handle this carefully to avoid breaking the SQL

    // First, remove simple single-line elements
    schema = schema
      // Remove CREATE EXTENSION statements
      .replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/gi, '')
      // Remove COMMENT ON statements
      .replace(/COMMENT ON (TABLE|COLUMN) [^;]+;/gi, '')
      // Remove trigger function definition
      .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?LANGUAGE plpgsql;/gi, '')
      // Remove trigger creations
      .replace(/CREATE TRIGGER [^;]+;/gi, '');

    // Remove CHECK constraints with regex operators and LENGTH function
    // pg-mem doesn't support these operators/functions
    const lines = schema.split('\n');
    const filteredLines: string[] = [];
    let inConstraint = false;
    let constraintBuffer: string[] = [];
    let parenDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line starts a CHECK constraint
      if (/CONSTRAINT\s+\w+\s+CHECK/i.test(line)) {
        inConstraint = true;
        constraintBuffer = [line];
        parenDepth = 0;
        // Count parens on this line
        for (const char of line) {
          if (char === '(') parenDepth++;
          if (char === ')') parenDepth--;
        }
        if (parenDepth === 0) {
          // Constraint complete on single line - check if it needs filtering
          const fullConstraint = constraintBuffer.join('\n');
          if (!fullConstraint.includes('~') && !/LENGTH\s*\(/i.test(fullConstraint)) {
            filteredLines.push(...constraintBuffer);
          }
          inConstraint = false;
          constraintBuffer = [];
        }
        continue;
      }

      if (inConstraint) {
        constraintBuffer.push(line);
        // Count parens to know when constraint ends
        for (const char of line) {
          if (char === '(') parenDepth++;
          if (char === ')') parenDepth--;
        }
        if (parenDepth === 0) {
          // Constraint complete - check if it needs filtering
          const fullConstraint = constraintBuffer.join('\n');
          if (!fullConstraint.includes('~') && !/LENGTH\s*\(/i.test(fullConstraint)) {
            filteredLines.push(...constraintBuffer);
          }
          inConstraint = false;
          constraintBuffer = [];
        }
        continue;
      }

      filteredLines.push(line);
    }

    schema = filteredLines.join('\n')
      // Clean up extra whitespace and trailing commas before closing parentheses
      .replace(/,(\s*[,)])/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      // pg-mem has issues with ON CONFLICT (column) when foreign keys exist
      // Change to ON CONFLICT ON CONSTRAINT for shop_status
      .replace(/ON CONFLICT \(branch_code\) DO NOTHING;[\s]*$/gm, function(match, offset, string) {
        // Only replace for shop_status insert (check context)
        const beforeMatch = string.substring(Math.max(0, offset - 200), offset);
        if (beforeMatch.includes('shop_status')) {
          return 'ON CONFLICT ON CONSTRAINT one_status_per_branch DO NOTHING;';
        }
        return match;
      });

    // Execute schema
    db.public.none(schema);

    console.log('✅ Schema loaded into pg-mem');
  });

  describe('Tables Existence', () => {
    it('should create branches table', async () => {
      const result = await db.public.many(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'branches'
      `);

      expect(result).toHaveLength(1);
      expect(result[0].table_name).toBe('branches');
    });

    it('should create users table', async () => {
      const result = await db.public.many(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      `);

      expect(result).toHaveLength(1);
      expect(result[0].table_name).toBe('users');
    });

    it('should create customer_magic_links table', async () => {
      const result = await db.public.many(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'customer_magic_links'
      `);

      expect(result).toHaveLength(1);
    });

    it('should create bookings table', async () => {
      const result = await db.public.many(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bookings'
      `);

      expect(result).toHaveLength(1);
    });

    it('should create shop_status table', async () => {
      const result = await db.public.many(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'shop_status'
      `);

      expect(result).toHaveLength(1);
    });

    it('should create sessions table', async () => {
      const result = await db.public.many(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'sessions'
      `);

      expect(result).toHaveLength(1);
    });
  });

  describe('Initial Data', () => {
    it('should have MAIN branch created', async () => {
      const result = await db.public.many(`
        SELECT branch_code, branch_name
        FROM branches
        WHERE branch_code = 'MAIN'
      `);

      expect(result).toHaveLength(1);
      expect(result[0].branch_code).toBe('MAIN');
      expect(result[0].branch_name).toBe('Main Branch');
    });

    it('should have shop_status for MAIN branch', async () => {
      const result = await db.public.many(`
        SELECT branch_code, is_open
        FROM shop_status
        WHERE branch_code = 'MAIN'
      `);

      expect(result).toHaveLength(1);
      expect(result[0].is_open).toBe(true);
    });
  });

  describe('Constraints', () => {
    it('should enforce valid booking status', async () => {
      // Try to insert invalid status
      await expect(async () => {
        await db.public.none(`
          INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, status, position)
          VALUES ('MAIN', 'ABC123', 'Toyota', 'Vios', 'invalid_status', 1)
        `);
      }).rejects.toThrow();
    });

    it('should enforce valid role constraint', async () => {
      // Try to insert invalid role
      await expect(async () => {
        await db.public.none(`
          INSERT INTO users (branch_code, username, password_hash, name, role)
          VALUES ('MAIN', 'testuser', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6', 'Test User', 'superadmin')
        `);
      }).rejects.toThrow();
    });
  });

  describe('Indexes', () => {
    it('should have unique index on (branch_code, username)', async () => {
      // Insert first user
      await db.public.none(`
        INSERT INTO users (branch_code, username, password_hash, name)
        VALUES ('MAIN', 'testuser', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6', 'Test User')
      `);

      // Try to insert duplicate username in same branch
      await expect(async () => {
        await db.public.none(`
          INSERT INTO users (branch_code, username, password_hash, name)
          VALUES ('MAIN', 'testuser', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6', 'Test User 2')
        `);
      }).rejects.toThrow();
    });

    it('should have unique index on magic link tokens', async () => {
      // Insert first magic link
      const userId = await db.public.one(`
        INSERT INTO users (branch_code, username, password_hash, name)
        VALUES ('MAIN', 'creator', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6', 'Creator')
        RETURNING user_id
      `);

      await db.public.none(`
        INSERT INTO customer_magic_links (branch_code, token, expires_at, created_by)
        VALUES ('MAIN', 'unique-token-123', NOW() + INTERVAL '24 hours', ${userId.user_id})
      `);

      // Try to insert duplicate token
      await expect(async () => {
        await db.public.none(`
          INSERT INTO customer_magic_links (branch_code, token, expires_at, created_by)
          VALUES ('MAIN', 'unique-token-123', NOW() + INTERVAL '24 hours', ${userId.user_id})
        `);
      }).rejects.toThrow();
    });
  });

  describe('Foreign Keys', () => {
    it('should enforce branch_code foreign key in users', async () => {
      // Try to insert user with non-existent branch
      await expect(async () => {
        await db.public.none(`
          INSERT INTO users (branch_code, username, password_hash, name)
          VALUES ('NONEXISTENT', 'testuser', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6', 'Test')
        `);
      }).rejects.toThrow();
    });

    it('should cascade delete when branch is deleted', async () => {
      // Create test branch
      await db.public.none(`
        INSERT INTO branches (branch_code, branch_name)
        VALUES ('TEST', 'Test Branch')
      `);

      // Create user in test branch
      await db.public.none(`
        INSERT INTO users (branch_code, username, password_hash, name)
        VALUES ('TEST', 'testuser2', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6', 'Test User 2')
      `);

      // Verify user exists
      let result = await db.public.many(`
        SELECT * FROM users WHERE branch_code = 'TEST'
      `);
      expect(result).toHaveLength(1);

      // Delete branch
      await db.public.none(`DELETE FROM branches WHERE branch_code = 'TEST'`);

      // Verify user was cascade deleted
      result = await db.public.many(`
        SELECT * FROM users WHERE branch_code = 'TEST'
      `);
      expect(result).toHaveLength(0);
    });
  });
});
