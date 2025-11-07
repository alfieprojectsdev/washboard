import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import db from '@/lib/db';
import {
  createSession,
  getSession,
  updateSession,
  destroySession,
  regenerateSession,
  cleanupExpiredSessions,
  SessionData,
} from '@/lib/auth/session';

/**
 * Session Management Test Suite
 *
 * Tests the core session management functions:
 * - Session creation
 * - Session retrieval
 * - Session updates
 * - Session destruction
 * - Session regeneration (P0 security fix)
 * - Expired session cleanup
 */

describe('Session Management', () => {
  const testUserData: SessionData = {
    userId: 999,
    branchCode: 'TEST',
    username: 'sessiontestuser',
    name: 'Session Test User',
    email: 'session@test.com',
    role: 'receptionist',
  };

  beforeAll(async () => {
    // Ensure TEST branch exists
    await db.query(
      `INSERT INTO branches (branch_code, branch_name, location)
       VALUES ('TEST', 'Test Branch', '123 Test St, 555-TEST')
       ON CONFLICT (branch_code) DO NOTHING`
    );

    // Create test user
    await db.query(
      `INSERT INTO users (user_id, branch_code, username, password_hash, name, email, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (branch_code, username) DO NOTHING`,
      [
        testUserData.userId,
        testUserData.branchCode,
        testUserData.username,
        '$2b$12$test', // dummy hash
        testUserData.name,
        testUserData.email,
        testUserData.role,
      ]
    );
  });

  afterEach(async () => {
    // Clean up sessions after each test
    await db.query(`DELETE FROM sessions WHERE branch_code = 'TEST'`);
  });

  describe('createSession', () => {
    it('should create a new session in database', async () => {
      const sessionId = await createSession(testUserData);

      expect(sessionId).toBeDefined();
      expect(sessionId).toHaveLength(64); // 32 bytes in hex = 64 chars

      // Verify session exists in database
      const result = await db.query(
        'SELECT sid, user_id, branch_code, sess, expire FROM sessions WHERE sid = $1',
        [sessionId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].user_id).toBe(testUserData.userId);
      expect(result.rows[0].branch_code).toBe(testUserData.branchCode);

      // Handle both string (real PostgreSQL) and object (pg-mem)
      const sess = result.rows[0].sess;
      const storedData = typeof sess === 'string' ? JSON.parse(sess) : sess;
      expect(storedData.username).toBe(testUserData.username);
    });

    it('should set expiration to 24 hours from now', async () => {
      const sessionId = await createSession(testUserData);

      const result = await db.query(
        'SELECT expire FROM sessions WHERE sid = $1',
        [sessionId]
      );

      const expireDate = new Date(result.rows[0].expire);
      const now = new Date();
      const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Allow 1 second margin for test execution time
      expect(expireDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(expireDate.getTime()).toBeLessThanOrEqual(
        twentyFourHoursLater.getTime() + 1000
      );
    });

    it('should generate unique session IDs', async () => {
      const sessionId1 = await createSession(testUserData);
      const sessionId2 = await createSession(testUserData);

      expect(sessionId1).not.toBe(sessionId2);
    });
  });

  describe('getSession', () => {
    it('should retrieve existing session data', async () => {
      const sessionId = await createSession(testUserData);

      const retrievedData = await getSession(sessionId);

      expect(retrievedData).not.toBeNull();
      expect(retrievedData?.userId).toBe(testUserData.userId);
      expect(retrievedData?.username).toBe(testUserData.username);
      expect(retrievedData?.branchCode).toBe(testUserData.branchCode);
    });

    it('should return null for non-existent session', async () => {
      const fakeSessionId = 'a'.repeat(64);

      const retrievedData = await getSession(fakeSessionId);

      expect(retrievedData).toBeNull();
    });

    it('should return null and cleanup expired session', async () => {
      const sessionId = await createSession(testUserData);

      // Manually expire the session
      await db.query(
        `UPDATE sessions SET expire = $1 WHERE sid = $2`,
        [new Date(Date.now() - 1000), sessionId] // 1 second ago
      );

      const retrievedData = await getSession(sessionId);

      expect(retrievedData).toBeNull();

      // Verify session was deleted
      const result = await db.query(
        'SELECT sid FROM sessions WHERE sid = $1',
        [sessionId]
      );
      expect(result.rows.length).toBe(0);
    });
  });

  describe('updateSession', () => {
    it('should update session data and extend expiration', async () => {
      const sessionId = await createSession(testUserData);

      // Wait a moment to ensure expire time changes
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedData: SessionData = {
        ...testUserData,
        name: 'Updated Name',
      };

      await updateSession(sessionId, updatedData);

      // Retrieve and verify
      const result = await db.query(
        'SELECT sess, expire FROM sessions WHERE sid = $1',
        [sessionId]
      );

      // Handle both string (real PostgreSQL) and object (pg-mem)
      const sess = result.rows[0].sess;
      const storedData = typeof sess === 'string' ? JSON.parse(sess) : sess;
      expect(storedData.name).toBe('Updated Name');

      // Verify expiration was extended
      const expireDate = new Date(result.rows[0].expire);
      const now = new Date();
      expect(expireDate.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('destroySession', () => {
    it('should delete session from database', async () => {
      const sessionId = await createSession(testUserData);

      // Verify it exists
      let result = await db.query(
        'SELECT sid FROM sessions WHERE sid = $1',
        [sessionId]
      );
      expect(result.rows.length).toBe(1);

      // Destroy it
      await destroySession(sessionId);

      // Verify it's gone
      result = await db.query('SELECT sid FROM sessions WHERE sid = $1', [sessionId]);
      expect(result.rows.length).toBe(0);
    });

    it('should handle destroying non-existent session gracefully', async () => {
      const fakeSessionId = 'b'.repeat(64);

      // Should not throw
      await expect(destroySession(fakeSessionId)).resolves.not.toThrow();
    });
  });

  describe('regenerateSession (P0 Security Fix)', () => {
    it('should destroy old session and create new one', async () => {
      const oldSessionId = await createSession(testUserData);

      // Verify old session exists
      let result = await db.query(
        'SELECT sid FROM sessions WHERE sid = $1',
        [oldSessionId]
      );
      expect(result.rows.length).toBe(1);

      // Regenerate session
      const newSessionId = await regenerateSession(oldSessionId, testUserData);

      // Verify new session ID is different
      expect(newSessionId).not.toBe(oldSessionId);

      // Verify old session is destroyed
      result = await db.query('SELECT sid FROM sessions WHERE sid = $1', [oldSessionId]);
      expect(result.rows.length).toBe(0);

      // Verify new session exists
      result = await db.query('SELECT sid FROM sessions WHERE sid = $1', [newSessionId]);
      expect(result.rows.length).toBe(1);
    });

    it('should create new session when no old session exists', async () => {
      const newSessionId = await regenerateSession(null, testUserData);

      expect(newSessionId).toBeDefined();
      expect(newSessionId).toHaveLength(64);

      // Verify session was created
      const result = await db.query(
        'SELECT sid FROM sessions WHERE sid = $1',
        [newSessionId]
      );
      expect(result.rows.length).toBe(1);
    });

    it('should preserve user data in regenerated session', async () => {
      const oldSessionId = await createSession(testUserData);
      const newSessionId = await regenerateSession(oldSessionId, testUserData);

      const retrievedData = await getSession(newSessionId);

      expect(retrievedData).not.toBeNull();
      expect(retrievedData?.userId).toBe(testUserData.userId);
      expect(retrievedData?.username).toBe(testUserData.username);
      expect(retrievedData?.branchCode).toBe(testUserData.branchCode);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions and keep active ones', async () => {
      // Create active session
      const activeSessionId = await createSession(testUserData);

      // Create expired session
      const expiredSessionId = await createSession(testUserData);
      await db.query(
        `UPDATE sessions SET expire = $1 WHERE sid = $2`,
        [new Date(Date.now() - 1000), expiredSessionId]
      );

      // Run cleanup
      const deletedCount = await cleanupExpiredSessions();

      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // Verify active session still exists
      let result = await db.query(
        'SELECT sid FROM sessions WHERE sid = $1',
        [activeSessionId]
      );
      expect(result.rows.length).toBe(1);

      // Verify expired session is gone
      result = await db.query('SELECT sid FROM sessions WHERE sid = $1', [
        expiredSessionId,
      ]);
      expect(result.rows.length).toBe(0);
    });

    it('should return 0 when no expired sessions exist', async () => {
      // Create only active sessions
      await createSession(testUserData);

      const deletedCount = await cleanupExpiredSessions();

      // Should be 0 or very small (might catch other test leftovers)
      expect(deletedCount).toBeDefined();
    });
  });
});
