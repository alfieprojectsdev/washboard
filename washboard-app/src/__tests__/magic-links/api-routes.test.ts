import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import db from '@/lib/db';
import { POST as generateHandler } from '@/app/api/magic-links/generate/route';
import { POST as validateHandler } from '@/app/api/magic-links/validate/route';
import * as sessionModule from '@/lib/auth/session';

/**
 * Magic Link API Routes Test Suite
 *
 * Tests the magic link HTTP API endpoints:
 * - POST /api/magic-links/generate (requires authentication)
 * - POST /api/magic-links/validate (public, no auth)
 *
 * Uses direct handler testing approach with mocked authentication.
 * All tests use pg-mem (mock database) via USE_MOCK_DB=true
 */

/**
 * Helper function to create mock NextRequest for testing
 */
function createMockRequest(url: string, body: unknown, options?: { headers?: Record<string, string> }) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...options?.headers,
    },
  });
}

describe('Magic Link API Routes', () => {
  const TEST_USER_ID = 999;
  const TEST_BRANCH_CODE = 'MAIN';

  beforeAll(async () => {
    // Ensure MAIN branch exists for testing
    const branchCheck = await db.query(
      'SELECT branch_code FROM branches WHERE branch_code = $1',
      [TEST_BRANCH_CODE]
    );

    if (branchCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO branches (branch_code, branch_name, address, phone)
         VALUES ($1, $2, $3, $4)`,
        [TEST_BRANCH_CODE, 'Main Branch', '123 Main St', '555-0100']
      );
    }

    // Create test user
    await db.query(
      `INSERT INTO users (user_id, branch_code, username, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [TEST_USER_ID, TEST_BRANCH_CODE, 'testuser', '$2b$12$test', 'Test User', 'receptionist']
    );
  });

  afterEach(async () => {
    // Clean up magic links created during tests
    await db.query(`DELETE FROM customer_magic_links WHERE branch_code = $1`, [TEST_BRANCH_CODE]);

    // Restore all mocks
    vi.restoreAllMocks();
  });

  describe('POST /api/magic-links/generate', () => {
    beforeEach(() => {
      // Mock getCurrentUser to return authenticated user for all tests in this suite
      // Individual tests can override this mock if needed
      vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue({
        userId: TEST_USER_ID,
        branchCode: TEST_BRANCH_CODE,
        username: 'testuser',
        name: 'Test User',
        email: null,
        role: 'receptionist',
      });
    });

    describe('Authentication', () => {
      it('should return 401 when not authenticated', async () => {
        // Override default mock to return null (not authenticated)
        vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue(null);

        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          { branchCode: TEST_BRANCH_CODE }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');
        expect(data.code).toBe('UNAUTHORIZED');
      });

      it('should return 403 for wrong branch access', async () => {
        // User is in MAIN branch, trying to access BRANCH_B
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          { branchCode: 'BRANCH_B' }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Cannot access data from different branch');
        expect(data.code).toBe('INVALID_BRANCH');
      });
    });

    describe('Success Cases', () => {
      it('should generate magic link with valid data', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          { branchCode: TEST_BRANCH_CODE }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.link).toBeDefined();
        expect(data.data.link.id).toBeDefined();
        expect(data.data.link.token).toHaveLength(128);
        expect(data.data.link.url).toContain(`/book/${TEST_BRANCH_CODE}/`);
        expect(data.data.link.url).toContain(data.data.link.token);
        expect(data.data.link.expiresAt).toBeDefined();

        // Verify it's a valid ISO 8601 timestamp
        const expiresDate = new Date(data.data.link.expiresAt);
        expect(expiresDate).toBeInstanceOf(Date);
        expect(expiresDate.getTime()).toBeGreaterThan(Date.now());
      });

      it('should generate magic link with customer info', async () => {
        const customerData = {
          branchCode: TEST_BRANCH_CODE,
          customerName: 'John Doe',
          customerMessenger: 'https://m.me/johndoe',
        };

        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          customerData
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.link.token).toBeDefined();

        // Verify customer info was stored in database
        const dbCheck = await db.query(
          'SELECT customer_name, customer_messenger FROM customer_magic_links WHERE token = $1',
          [data.data.link.token]
        );

        expect(dbCheck.rows.length).toBe(1);
        expect(dbCheck.rows[0].customer_name).toBe('John Doe');
        expect(dbCheck.rows[0].customer_messenger).toBe('https://m.me/johndoe');
      });

      it('should return QR code data URL', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          { branchCode: TEST_BRANCH_CODE }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.data.qrCode).toBeDefined();
        expect(data.data.qrCode).toMatch(/^data:image\/png;base64,/);
        expect(data.data.qrCode.length).toBeGreaterThan(100); // Should contain substantial base64 data
      });

      it('should store link in database', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          {
            branchCode: TEST_BRANCH_CODE,
            customerName: 'Jane Smith',
          }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);

        // Verify link exists in database with correct fields
        const dbCheck = await db.query(
          `SELECT id, token, branch_code, customer_name, expires_at, created_by, used_at
           FROM customer_magic_links
           WHERE token = $1`,
          [data.data.link.token]
        );

        expect(dbCheck.rows.length).toBe(1);
        const dbLink = dbCheck.rows[0];
        expect(dbLink.id).toBe(data.data.link.id);
        expect(dbLink.token).toHaveLength(128);
        expect(dbLink.branch_code).toBe(TEST_BRANCH_CODE);
        expect(dbLink.customer_name).toBe('Jane Smith');
        expect(dbLink.created_by).toBe(TEST_USER_ID);
        expect(dbLink.used_at).toBeNull();
        expect(new Date(dbLink.expires_at).getTime()).toBeGreaterThan(Date.now());
      });

      it('should normalize branch code to uppercase', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          { branchCode: 'main' } // lowercase
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.data.link.url).toContain('/book/MAIN/'); // uppercase in URL

        // Verify uppercase in database
        const dbCheck = await db.query(
          'SELECT branch_code FROM customer_magic_links WHERE token = $1',
          [data.data.link.token]
        );
        expect(dbCheck.rows[0].branch_code).toBe('MAIN');
      });

      it('should generate QR code with custom size', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          {
            branchCode: TEST_BRANCH_CODE,
            qrSize: 500,
          }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.data.qrCode).toMatch(/^data:image\/png;base64,/);
        // QR code should be generated (can't verify exact size from base64, but it should work)
      });
    });

    describe('Validation', () => {
      it('should return 400 when branch_code missing', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          {} // No branchCode
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing required field: branchCode');
        expect(data.code).toBe('MISSING_FIELDS');
      });

      it('should return 400 when branch_code is empty string', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          { branchCode: '' }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('MISSING_FIELDS');
      });

      it('should return 400 when branch_code is not a string', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          { branchCode: 123 } // number instead of string
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('MISSING_FIELDS');
      });

      it('should handle optional fields correctly', async () => {
        // Only branchCode provided, no customer info
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          { branchCode: TEST_BRANCH_CODE }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(201);

        // Verify optional fields are null in database
        const dbCheck = await db.query(
          'SELECT customer_name, customer_messenger FROM customer_magic_links WHERE token = $1',
          [data.data.link.token]
        );

        expect(dbCheck.rows[0].customer_name).toBeNull();
        expect(dbCheck.rows[0].customer_messenger).toBeNull();
      });

      it('should return 400 for invalid customerMessenger format', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/generate',
          {
            branchCode: TEST_BRANCH_CODE,
            customerMessenger: 12345, // Not a string
          }
        );

        const response = await generateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid customerMessenger format');
        expect(data.code).toBe('INVALID_MESSENGER');
      });
    });
  });

  describe('POST /api/magic-links/validate', () => {
    /**
     * Helper function to generate a magic link for validation tests
     */
    async function generateTestMagicLink(options: {
      customerName?: string;
      customerMessenger?: string;
    } = {}): Promise<string> {
      // Mock authentication for generation
      vi.spyOn(sessionModule, 'getCurrentUser').mockResolvedValue({
        userId: TEST_USER_ID,
        branchCode: TEST_BRANCH_CODE,
        username: 'testuser',
        name: 'Test User',
        email: null,
        role: 'receptionist',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/magic-links/generate',
        {
          branchCode: TEST_BRANCH_CODE,
          ...options,
        }
      );

      const response = await generateHandler(request);
      const data = await response.json();

      return data.data.link.token;
    }

    describe('Success Cases', () => {
      it('should return valid=true for active magic link', async () => {
        const token = await generateTestMagicLink();

        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token }
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.valid).toBe(true);
        expect(data.data.error).toBeUndefined();
      });

      it('should return link metadata when valid', async () => {
        const token = await generateTestMagicLink({
          customerName: 'Bob Johnson',
          customerMessenger: 'https://m.me/bobjohnson',
        });

        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token }
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.valid).toBe(true);
        expect(data.data.link).toBeDefined();
        expect(data.data.link.id).toBeDefined();
        expect(data.data.link.branchCode).toBe(TEST_BRANCH_CODE);
        expect(data.data.link.customerName).toBe('Bob Johnson');
        expect(data.data.link.customerMessenger).toBe('https://m.me/bobjohnson');
      });
    });

    describe('Invalid Cases', () => {
      it('should return valid=false for non-existent token', async () => {
        const fakeToken = 'a'.repeat(128); // Valid format but doesn't exist

        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token: fakeToken }
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200); // Always 200 for security
        expect(data.success).toBe(true);
        expect(data.data.valid).toBe(false);
        expect(data.data.error).toBe('NOT_FOUND');
        expect(data.data.link).toBeUndefined();
      });

      it('should return valid=false with EXPIRED error for expired link', async () => {
        const token = await generateTestMagicLink();

        // Manually expire the link in database
        const expiredDate = new Date(Date.now() - 1000); // 1 second ago
        await db.query(
          'UPDATE customer_magic_links SET expires_at = $1 WHERE token = $2',
          [expiredDate, token]
        );

        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token }
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200); // Always 200 for security
        expect(data.success).toBe(true);
        expect(data.data.valid).toBe(false);
        expect(data.data.error).toBe('EXPIRED');
        expect(data.data.link).toBeUndefined();
      });

      it('should return valid=false with ALREADY_USED for used link', async () => {
        const token = await generateTestMagicLink();

        // Mark link as used in database
        const usedDate = new Date();
        await db.query(
          'UPDATE customer_magic_links SET used_at = $1, booking_id = $2 WHERE token = $3',
          [usedDate, 123, token]
        );

        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token }
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200); // Always 200 for security
        expect(data.success).toBe(true);
        expect(data.data.valid).toBe(false);
        expect(data.data.error).toBe('ALREADY_USED');
        expect(data.data.link).toBeUndefined();
      });

      it('should always return 200 status for security', async () => {
        // Test with non-existent token
        const fakeToken = 'b'.repeat(128);

        const request1 = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token: fakeToken }
        );

        const response1 = await validateHandler(request1);
        expect(response1.status).toBe(200);

        // Test with valid token
        const validToken = await generateTestMagicLink();

        const request2 = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token: validToken }
        );

        const response2 = await validateHandler(request2);
        expect(response2.status).toBe(200);

        // Security: Both valid and invalid tokens return 200
        // This prevents timing attacks and information leakage
      });
    });

    describe('Validation', () => {
      it('should return 400 for missing token', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          {} // No token
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid token format');
        expect(data.code).toBe('INVALID_TOKEN');
      });

      it('should return 400 for invalid token format', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token: 'short-token' } // Wrong length
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid token format');
        expect(data.code).toBe('INVALID_TOKEN');
      });

      it('should return 400 for token that is not a string', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token: 12345 } // Not a string
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('INVALID_TOKEN');
      });

      it('should return 400 for token with wrong length', async () => {
        const request = createMockRequest(
          'http://localhost:3000/api/magic-links/validate',
          { token: 'a'.repeat(100) } // Wrong length (should be 128)
        );

        const response = await validateHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.code).toBe('INVALID_TOKEN');
      });
    });
  });
});
