// src/lib/magic-links/token-generator.ts
import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure token for magic links
 *
 * This function produces a 128-character URL-safe token suitable for one-time
 * authentication links. The token is generated using Node.js's crypto module
 * for cryptographic security.
 *
 * Security Properties:
 * - Uses crypto.randomBytes (CSPRNG) for cryptographic randomness
 * - 96 bytes of entropy (768 bits)
 * - Collision probability: ~2^-768 (astronomically unlikely)
 * - URL-safe: Compatible with query parameters and URL paths
 * - No predictable patterns or sequences
 *
 * Output Format:
 * - Length: Exactly 128 characters
 * - Character set: A-Z, a-z, 0-9, -, _
 * - No padding characters (=)
 *
 * @returns {string} 128-character URL-safe base64 token
 *
 * @example
 * const token = generateSecureToken();
 * // Returns: "aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC9dE1fG3hI5jK7lM9nO1pQ3rS5tU7vW9xY1zA3bC5dE7fG9hI1jK3lM5nO7pQ9rS1tU3vW5xY7zA9bC1dE3fG5hI7jK9"
 */
export function generateSecureToken(): string {
  // Generate 96 bytes of cryptographically secure random data
  // 96 bytes = 768 bits of entropy
  // Base64 encoding: 96 bytes * 4/3 = 128 characters
  const buffer = randomBytes(96);

  // Convert to base64 and make URL-safe
  const base64 = buffer.toString('base64');

  // Replace URL-unsafe characters and remove padding
  // + -> - (URL-safe)
  // / -> _ (URL-safe)
  // Remove = padding
  const urlSafeToken = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return urlSafeToken;
}
