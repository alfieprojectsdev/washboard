// src/lib/magic-links/utils.ts
import db from '@/lib/db';
import { generateSecureToken } from './token-generator';

/**
 * Data required to generate a new magic link
 */
export interface MagicLinkData {
  branchCode: string;
  customerName?: string;
  customerMessenger?: string;
  createdBy: number; // user_id of receptionist
  baseUrl?: string; // Optional base URL for link generation (auto-detected from request)
}

/**
 * Magic link record with generated URL
 */
export interface MagicLink {
  id: number;
  token: string;
  branchCode: string;
  expiresAt: Date;
  url: string; // Full URL for the magic link
}

/**
 * Result of magic link validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_USED';
  link?: {
    id: number;
    branchCode: string;
    customerName?: string;
    customerMessenger?: string;
  };
}

/**
 * Generate a new magic link for customer booking access
 *
 * Creates a cryptographically secure, single-use magic link that expires
 * in 24 hours. The link allows customers to submit car wash bookings
 * without authentication.
 *
 * Security Features:
 * - 128-character cryptographically secure token
 * - 24-hour expiration from creation
 * - Single-use enforcement (marked as used after booking creation)
 * - Unique token constraint in database
 *
 * @param data - Magic link configuration
 * @param data.branchCode - Branch code for the booking (e.g., "MAIN")
 * @param data.customerName - Optional customer name
 * @param data.customerMessenger - Optional Facebook Messenger URL
 * @param data.createdBy - User ID of the receptionist creating the link
 * @returns Promise resolving to magic link with URL
 * @throws Error if database insertion fails
 *
 * @example
 * const link = await generateMagicLink({
 *   branchCode: 'MAIN',
 *   customerName: 'John Doe',
 *   createdBy: 1
 * });
 * // link.url = "https://example.com/book/MAIN/aB3dE5f..."
 */
export async function generateMagicLink(data: MagicLinkData): Promise<MagicLink> {
  try {
    // Generate cryptographically secure token
    const token = generateSecureToken();

    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Insert into database
    const result = await db.query(
      `INSERT INTO customer_magic_links
       (branch_code, token, customer_name, customer_messenger, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, branch_code, token, expires_at`,
      [
        data.branchCode.toUpperCase(),
        token,
        data.customerName || null,
        data.customerMessenger || null,
        expiresAt,
        data.createdBy
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create magic link');
    }

    const row = result.rows[0];

    // Generate full URL
    // Priority: 1) Provided baseUrl, 2) Environment variable, 3) Localhost fallback
    const baseUrl = data.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/book/${row.branch_code}/${row.token}`;

    return {
      id: row.id,
      token: row.token,
      branchCode: row.branch_code,
      expiresAt: new Date(row.expires_at),
      url
    };
  } catch (err) {
    console.error('Failed to generate magic link:', err);
    throw new Error('Failed to create magic link');
  }
}

/**
 * Validate a magic link token
 *
 * Checks if a magic link token is valid for use. A valid token must:
 * - Exist in the database
 * - Not be expired (expires_at > NOW())
 * - Not be already used (used_at IS NULL)
 *
 * This function does NOT mark the link as used. Call markMagicLinkUsed()
 * after successful booking creation.
 *
 * @param token - The 128-character magic link token
 * @returns Promise resolving to validation result
 *
 * @example
 * const result = await validateMagicLink(token);
 * if (!result.valid) {
 *   console.error(`Invalid link: ${result.error}`);
 *   return;
 * }
 * // Proceed with booking using result.link data
 */
export async function validateMagicLink(token: string): Promise<ValidationResult> {
  try {
    const result = await db.query(
      `SELECT id, branch_code, customer_name, customer_messenger, expires_at, used_at
       FROM customer_magic_links
       WHERE token = $1`,
      [token]
    );

    // Link not found
    if (result.rows.length === 0) {
      return {
        valid: false,
        error: 'NOT_FOUND'
      };
    }

    const row = result.rows[0];

    // Link already used
    if (row.used_at !== null) {
      return {
        valid: false,
        error: 'ALREADY_USED'
      };
    }

    // Link expired
    const now = new Date();
    const expiresAt = new Date(row.expires_at);
    if (expiresAt <= now) {
      return {
        valid: false,
        error: 'EXPIRED'
      };
    }

    // Valid link
    return {
      valid: true,
      link: {
        id: row.id,
        branchCode: row.branch_code,
        customerName: row.customer_name,
        customerMessenger: row.customer_messenger
      }
    };
  } catch (err) {
    console.error('Failed to validate magic link:', err);
    // Return NOT_FOUND on error (fail closed)
    return {
      valid: false,
      error: 'NOT_FOUND'
    };
  }
}

/**
 * Mark a magic link as used (single-use enforcement)
 *
 * Updates the magic link record to prevent reuse. Sets:
 * - used_at = NOW()
 * - booking_id = provided booking ID
 *
 * This should be called immediately after successful booking creation
 * to enforce single-use semantics.
 *
 * @param token - The 128-character magic link token
 * @param bookingId - The ID of the booking created with this link
 * @returns Promise resolving when update completes
 * @throws Error if database update fails
 *
 * @example
 * // After creating a booking
 * await markMagicLinkUsed(token, booking.id);
 */
export async function markMagicLinkUsed(token: string, bookingId: number): Promise<void> {
  try {
    await db.query(
      `UPDATE customer_magic_links
       SET used_at = NOW(), booking_id = $1
       WHERE token = $2`,
      [bookingId, token]
    );
  } catch (err) {
    console.error('Failed to mark magic link as used:', err);
    throw new Error('Failed to mark magic link as used');
  }
}
