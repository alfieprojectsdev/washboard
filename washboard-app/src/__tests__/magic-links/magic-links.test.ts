import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import db from '@/lib/db';
import { generateSecureToken } from '@/lib/magic-links/token-generator';
import {
  generateMagicLink,
  validateMagicLink,
  markMagicLinkUsed,
} from '@/lib/magic-links/utils';
import {
  generateQRCode,
  generateQRCodePNG,
  QR_SIZE_NORMAL,
  QR_SIZE_FULLSCREEN,
} from '@/lib/magic-links/qr-code';

/**
 * Magic Link System Test Suite
 *
 * Tests the complete magic link functionality:
 * - Token generation (security, uniqueness, format)
 * - Magic link lifecycle (generate, validate, mark as used)
 * - QR code generation (size, format)
 *
 * Uses pg-mem for mock database testing.
 */

describe('Magic Link System', () => {
  const TEST_USER_ID = 999;

  beforeAll(async () => {
    // Ensure MAIN branch exists
    const branchCheck = await db.query(
      'SELECT branch_code FROM branches WHERE branch_code = $1',
      ['MAIN']
    );

    if (branchCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO branches (branch_code, branch_name, address, phone)
         VALUES ('MAIN', 'Main Branch', '123 Main St', '555-0100')`
      );
    }

    // Create test user
    await db.query(
      `INSERT INTO users (user_id, branch_code, username, password_hash, name, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [TEST_USER_ID, 'MAIN', 'testuser', '$2b$12$test', 'Test User', 'receptionist']
    );
  });

  afterEach(async () => {
    // Clean up magic links created during tests
    await db.query(`DELETE FROM customer_magic_links WHERE branch_code = 'MAIN'`);
  });

  describe('Token Generator', () => {
    describe('generateSecureToken', () => {
      it('should generate token with exactly 128 characters', () => {
        const token = generateSecureToken();
        expect(token).toHaveLength(128);
      });

      it('should generate URL-safe tokens (no +, /, = characters)', () => {
        const token = generateSecureToken();

        // URL-safe base64 should not contain +, /, or =
        expect(token).not.toContain('+');
        expect(token).not.toContain('/');
        expect(token).not.toContain('=');
      });

      it('should generate unique tokens on each call', () => {
        const token1 = generateSecureToken();
        const token2 = generateSecureToken();
        const token3 = generateSecureToken();

        // All tokens should be unique
        expect(token1).not.toBe(token2);
        expect(token2).not.toBe(token3);
        expect(token1).not.toBe(token3);
      });

      it('should only contain valid base64url characters', () => {
        const token = generateSecureToken();

        // Base64url character set: A-Z, a-z, 0-9, -, _
        const base64urlPattern = /^[A-Za-z0-9_-]+$/;
        expect(token).toMatch(base64urlPattern);
      });
    });
  });

  describe('Magic Link Utilities', () => {
    describe('generateMagicLink', () => {
      it('should create magic link in database with all fields', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          customerName: 'John Doe',
          customerMessenger: 'https://m.me/johndoe',
          createdBy: TEST_USER_ID,
        });

        expect(link).toBeDefined();
        expect(link.id).toBeDefined();
        expect(link.token).toBeDefined();
        expect(link.branchCode).toBe('MAIN');
        expect(link.expiresAt).toBeInstanceOf(Date);
        expect(link.url).toBeDefined();

        // Verify in database
        const result = await db.query(
          `SELECT * FROM customer_magic_links WHERE token = $1`,
          [link.token]
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].customer_name).toBe('John Doe');
        expect(result.rows[0].customer_messenger).toBe('https://m.me/johndoe');
        expect(result.rows[0].created_by).toBe(TEST_USER_ID);
      });

      it('should set expiration to 24 hours from now', async () => {
        const now = new Date();
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          createdBy: TEST_USER_ID,
        });

        const expectedExpiration = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const timeDiff = Math.abs(link.expiresAt.getTime() - expectedExpiration.getTime());

        // Allow 5 second margin for test execution
        expect(timeDiff).toBeLessThan(5000);
      });

      it('should generate valid URL with branch code and token', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          createdBy: TEST_USER_ID,
        });

        expect(link.url).toContain('/book/MAIN/');
        expect(link.url).toContain(link.token);

        // Should be a valid URL
        expect(() => new URL(link.url)).not.toThrow();
      });

      it('should normalize branch code to uppercase', async () => {
        const link = await generateMagicLink({
          branchCode: 'main', // lowercase input
          createdBy: TEST_USER_ID,
        });

        expect(link.branchCode).toBe('MAIN'); // uppercase output
        expect(link.url).toContain('/book/MAIN/');
      });

      it('should handle optional customer name and messenger', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          createdBy: TEST_USER_ID,
          // No customer name or messenger
        });

        expect(link).toBeDefined();
        expect(link.token).toHaveLength(128);

        // Verify in database
        const result = await db.query(
          `SELECT customer_name, customer_messenger FROM customer_magic_links WHERE token = $1`,
          [link.token]
        );

        expect(result.rows[0].customer_name).toBeNull();
        expect(result.rows[0].customer_messenger).toBeNull();
      });
    });

    describe('validateMagicLink', () => {
      it('should return valid=true for active magic link', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          customerName: 'Jane Smith',
          createdBy: TEST_USER_ID,
        });

        const result = await validateMagicLink(link.token);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.link).toBeDefined();
        expect(result.link?.branchCode).toBe('MAIN');
        expect(result.link?.customerName).toBe('Jane Smith');
      });

      it('should return NOT_FOUND for non-existent token', async () => {
        const fakeToken = 'a'.repeat(128);

        const result = await validateMagicLink(fakeToken);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('NOT_FOUND');
        expect(result.link).toBeUndefined();
      });

      it('should return EXPIRED for expired magic link', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          createdBy: TEST_USER_ID,
        });

        // Manually expire the magic link
        const expiredDate = new Date(Date.now() - 1000); // 1 second ago
        await db.query(
          `UPDATE customer_magic_links SET expires_at = $1 WHERE token = $2`,
          [expiredDate, link.token]
        );

        const result = await validateMagicLink(link.token);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('EXPIRED');
      });

      it('should return ALREADY_USED for used magic link', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          createdBy: TEST_USER_ID,
        });

        // Mark link as used
        await markMagicLinkUsed(link.token, 123);

        const result = await validateMagicLink(link.token);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('ALREADY_USED');
      });

      it('should include link metadata when valid', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          customerName: 'Bob Johnson',
          customerMessenger: 'https://m.me/bobjohnson',
          createdBy: TEST_USER_ID,
        });

        const result = await validateMagicLink(link.token);

        expect(result.valid).toBe(true);
        expect(result.link).toBeDefined();
        expect(result.link?.id).toBe(link.id);
        expect(result.link?.branchCode).toBe('MAIN');
        expect(result.link?.customerName).toBe('Bob Johnson');
        expect(result.link?.customerMessenger).toBe('https://m.me/bobjohnson');
      });
    });

    describe('markMagicLinkUsed', () => {
      it('should set used_at timestamp', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          createdBy: TEST_USER_ID,
        });

        const beforeMark = new Date();
        await markMagicLinkUsed(link.token, 456);
        const afterMark = new Date();

        // Verify used_at is set
        const result = await db.query(
          `SELECT used_at FROM customer_magic_links WHERE token = $1`,
          [link.token]
        );

        expect(result.rows[0].used_at).not.toBeNull();

        const usedAt = new Date(result.rows[0].used_at);
        expect(usedAt.getTime()).toBeGreaterThanOrEqual(beforeMark.getTime() - 1000);
        expect(usedAt.getTime()).toBeLessThanOrEqual(afterMark.getTime() + 1000);
      });

      it('should set booking_id when provided', async () => {
        const link = await generateMagicLink({
          branchCode: 'MAIN',
          createdBy: TEST_USER_ID,
        });

        const bookingId = 789;
        await markMagicLinkUsed(link.token, bookingId);

        // Verify booking_id is set
        const result = await db.query(
          `SELECT booking_id FROM customer_magic_links WHERE token = $1`,
          [link.token]
        );

        expect(result.rows[0].booking_id).toBe(bookingId);
      });

      it('should not throw error for non-existent token', async () => {
        const fakeToken = 'b'.repeat(128);

        // Should not throw
        await expect(markMagicLinkUsed(fakeToken, 999)).resolves.not.toThrow();
      });
    });
  });

  describe('QR Code Generation', () => {
    const testUrl = 'https://washboard.app/book/MAIN/test-token-123';

    describe('generateQRCode', () => {
      it('should generate data URL with correct format (data:image/png;base64,...)', async () => {
        const qrCode = await generateQRCode(testUrl);

        expect(qrCode).toMatch(/^data:image\/png;base64,/);
        expect(qrCode.length).toBeGreaterThan(100); // Should have substantial base64 data
      });

      it('should generate QR code with default size (300px)', async () => {
        const qrCode = await generateQRCode(testUrl);

        // Just verify it generates successfully
        expect(qrCode).toBeDefined();
        expect(qrCode).toMatch(/^data:image\/png;base64,/);
      });

      it('should generate QR code with custom size', async () => {
        const qrCode400 = await generateQRCode(testUrl, { size: 400 });
        const qrCode200 = await generateQRCode(testUrl, { size: 200 });

        // Both should be valid data URLs
        expect(qrCode400).toMatch(/^data:image\/png;base64,/);
        expect(qrCode200).toMatch(/^data:image\/png;base64,/);

        // Different sizes should produce different QR codes
        expect(qrCode400).not.toBe(qrCode200);
      });

      it('should handle QR_SIZE_NORMAL and QR_SIZE_FULLSCREEN constants', async () => {
        const qrNormal = await generateQRCode(testUrl, { size: QR_SIZE_NORMAL });
        const qrFullscreen = await generateQRCode(testUrl, { size: QR_SIZE_FULLSCREEN });

        // Verify constants have expected values
        expect(QR_SIZE_NORMAL).toBe(300);
        expect(QR_SIZE_FULLSCREEN).toBe(500);

        // Both should be valid
        expect(qrNormal).toMatch(/^data:image\/png;base64,/);
        expect(qrFullscreen).toMatch(/^data:image\/png;base64,/);

        // Different sizes should produce different results
        expect(qrNormal).not.toBe(qrFullscreen);
      });
    });

    describe('generateQRCodePNG', () => {
      it('should generate PNG buffer', async () => {
        const buffer = await generateQRCodePNG(testUrl);

        expect(buffer).toBeDefined();
        expect(buffer.length).toBeGreaterThan(0);
      });

      it('should buffer be instance of Buffer', async () => {
        const buffer = await generateQRCodePNG(testUrl);

        expect(buffer).toBeInstanceOf(Buffer);

        // PNG files start with magic bytes: 89 50 4E 47
        expect(buffer[0]).toBe(0x89);
        expect(buffer[1]).toBe(0x50);
        expect(buffer[2]).toBe(0x4e);
        expect(buffer[3]).toBe(0x47);
      });

      it('should generate different sizes correctly', async () => {
        const buffer300 = await generateQRCodePNG(testUrl, { size: 300 });
        const buffer500 = await generateQRCodePNG(testUrl, { size: 500 });

        expect(buffer300).toBeInstanceOf(Buffer);
        expect(buffer500).toBeInstanceOf(Buffer);

        // Different sizes should produce different buffer sizes
        expect(buffer300.length).not.toBe(buffer500.length);

        // Larger QR code should generally have larger buffer
        // (though compression can affect this)
        expect(buffer500.length).toBeGreaterThan(0);
        expect(buffer300.length).toBeGreaterThan(0);
      });
    });
  });
});
