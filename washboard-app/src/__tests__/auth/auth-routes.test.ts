import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import db from '@/lib/db';
import { POST as signupHandler } from '@/app/api/auth/signup/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { clearRateLimitStore } from '@/lib/auth/rate-limit';

/**
 * Auth Routes Test Suite
 *
 * Tests the authentication API routes:
 * - /api/auth/signup (receptionist registration)
 * - /api/auth/login (session-based login with regeneration)
 * - /api/auth/logout (session destruction)
 *
 * All tests use pg-mem (mock database) via USE_MOCK_DB=true
 */

describe('Authentication API Routes', () => {
  beforeAll(async () => {
    // Ensure MAIN branch exists for testing
    const branchCheck = await db.query(
      'SELECT branch_code FROM branches WHERE branch_code = $1',
      ['MAIN']
    );

    if (branchCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO branches (branch_code, branch_name, location)
         VALUES ('MAIN', 'Main Branch', '123 Main St, 555-0100')`
      );
    }

    // Clean up any test users from previous runs
    await db.query(
      `DELETE FROM users WHERE username IN ('testuser', 'loginuser', 'duplicateuser')`
    );
  });

  afterEach(async () => {
    // Clean up test data after each test
    await db.query(
      `DELETE FROM sessions WHERE user_id IN (
        SELECT user_id FROM users WHERE username IN ('testuser', 'loginuser', 'duplicateuser')
      )`
    );

    // Clear rate limit store to prevent test interference
    clearRateLimitStore();
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new receptionist user with valid data', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'testuser',
        password: 'SecurePassword123!',
        name: 'Test User',
        email: 'test@example.com',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'content-type': 'application/json',
        },
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('testuser');
      expect(data.user.branchCode).toBe('MAIN');
      expect(data.user.role).toBe('receptionist');
      expect(data.user.password_hash).toBeUndefined(); // Should not expose hash

      // Verify password was hashed in database
      const dbUser = await db.query(
        'SELECT password_hash FROM users WHERE username = $1',
        ['testuser']
      );
      expect(dbUser.rows[0].password_hash).toBeDefined();
      expect(dbUser.rows[0].password_hash).not.toBe(requestBody.password);
    });

    it('should reject signup with password less than 12 characters', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'testuser2',
        password: 'short',
        name: 'Test User',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('12 characters');
      expect(data.code).toBe('WEAK_PASSWORD');
    });

    it('should reject signup with invalid username format', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'test user!',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_USERNAME');
    });

    it('should reject duplicate username in same branch', async () => {
      // Create first user
      const requestBody = {
        branch_code: 'MAIN',
        username: 'duplicateuser',
        password: 'SecurePassword123!',
        name: 'First User',
      };

      const request1 = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      await signupHandler(request1);

      // Try to create duplicate
      const request2 = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await signupHandler(request2);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('DUPLICATE_USERNAME');
    });

    it('should reject signup with invalid email format', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'testuser3',
        password: 'SecurePassword123!',
        name: 'Test User',
        email: 'invalid-email',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_EMAIL');
    });

    it('should reject signup with non-existent branch', async () => {
      const requestBody = {
        branch_code: 'NONEXISTENT',
        username: 'testuser4',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await signupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_BRANCH');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUserPassword: string;

    beforeAll(async () => {
      // Create a test user for login tests
      testUserPassword = 'LoginPassword123!';
      const passwordHash = await bcrypt.hash(testUserPassword, 12);

      await db.query(
        `INSERT INTO users (branch_code, username, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (branch_code, username) DO NOTHING`,
        ['MAIN', 'loginuser', passwordHash, 'Login Test User', 'receptionist']
      );
    });

    it('should login successfully with correct credentials', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'loginuser',
        password: testUserPassword,
      };

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.username).toBe('loginuser');
      expect(data.user.branchCode).toBe('MAIN');
      expect(data.user.password_hash).toBeUndefined();

      // Verify session cookie was set
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('washboard_session');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader?.toLowerCase()).toContain('samesite=lax');
    });

    it('should reject login with incorrect password', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'loginuser',
        password: 'WrongPassword123!',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid credentials'); // Generic message
      expect(data.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent username', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'nonexistentuser',
        password: 'SomePassword123!',
      };

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid credentials'); // Generic message
      expect(data.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with wrong branch code', async () => {
      const requestBody = {
        branch_code: 'WRONG',
        username: 'loginuser',
        password: testUserPassword,
      };

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid credentials'); // Generic message
      expect(data.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing fields', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'loginuser',
        // Missing password
      };

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('MISSING_FIELDS');
    });

    it('should create session in database after successful login', async () => {
      const requestBody = {
        branch_code: 'MAIN',
        username: 'loginuser',
        password: testUserPassword,
      };

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const response = await loginHandler(request);

      // Extract session ID from cookie
      const setCookieHeader = response.headers.get('set-cookie');
      const sessionIdMatch = setCookieHeader?.match(/washboard_session=([^;]+)/);
      expect(sessionIdMatch).toBeDefined();

      const sessionId = sessionIdMatch![1];

      // Verify session exists in database
      const sessionCheck = await db.query(
        'SELECT sid, user_id, branch_code FROM sessions WHERE sid = $1',
        [sessionId]
      );

      expect(sessionCheck.rows.length).toBe(1);
      expect(sessionCheck.rows[0].branch_code).toBe('MAIN');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully and clear session', async () => {
      // First login to get a session
      const loginBody = {
        branch_code: 'MAIN',
        username: 'loginuser',
        password: 'LoginPassword123!',
      };

      const loginRequest = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginBody),
      });

      const loginResponse = await loginHandler(loginRequest);
      const setCookieHeader = loginResponse.headers.get('set-cookie');
      const sessionIdMatch = setCookieHeader?.match(/washboard_session=([^;]+)/);
      const sessionId = sessionIdMatch![1];

      // Now logout
      const logoutRequest = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `washboard_session=${sessionId}`,
        },
      });

      const logoutResponse = await logoutHandler(logoutRequest);
      const data = await logoutResponse.json();

      expect(logoutResponse.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify session cookie was cleared
      const clearCookieHeader = logoutResponse.headers.get('set-cookie');
      expect(clearCookieHeader).toContain('washboard_session=');
      // Cookie deletion can use either Max-Age=0 or Expires in the past
      expect(
        clearCookieHeader?.includes('Max-Age=0') ||
        clearCookieHeader?.includes('Expires=Thu, 01 Jan 1970')
      ).toBe(true);

      // Verify session was destroyed in database
      const sessionCheck = await db.query(
        'SELECT sid FROM sessions WHERE sid = $1',
        [sessionId]
      );

      expect(sessionCheck.rows.length).toBe(0);
    });

    it('should handle logout without active session gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
      });

      const response = await logoutHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
