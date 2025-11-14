// src/lib/auth/rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: {
    error: string;
    code: string;
  };
}

/**
 * Get client IP address from request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Check rate limit using PostgreSQL database (serverless-compatible)
 * Returns NextResponse with error if limit exceeded, null otherwise
 */
async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    // Start transaction for atomic rate limit check + update
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Clean up old entries (outside current window)
      await client.query(
        'DELETE FROM rate_limits WHERE window_start < $1',
        [windowStart]
      );

      // Get or create rate limit entry
      const result = await client.query(
        `INSERT INTO rate_limits (endpoint, identifier, count, window_start)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (endpoint, identifier)
         DO UPDATE SET
           count = CASE
             WHEN rate_limits.window_start < $4 THEN 1
             ELSE rate_limits.count + 1
           END,
           window_start = CASE
             WHEN rate_limits.window_start < $4 THEN $3
             ELSE rate_limits.window_start
           END
         RETURNING count, window_start`,
        [endpoint, identifier, now, windowStart]
      );

      await client.query('COMMIT');

      const { count, window_start } = result.rows[0];

      // Check if limit exceeded
      if (count > config.max) {
        const resetTime = new Date(new Date(window_start).getTime() + config.windowMs);
        const retryAfter = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);

        return NextResponse.json(
          config.message,
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.max.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': resetTime.toISOString()
            }
          }
        );
      }

      return null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Rate limit check error:', err);
    // On error, allow request through (fail-open to prevent DOS via db errors)
    return null;
  }
}

/**
 * Rate limiter for signup endpoint
 * P0 Security Fix: Prevents mass account creation
 *
 * Limit: 3 attempts per hour per IP
 */
export const signupLimiter = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: {
    error: 'Too many signup attempts. Please try again in 1 hour.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
};

/**
 * Rate limiter for login endpoint
 * P0 Security Fix: Prevents brute force attacks
 *
 * Limit: 5 attempts per 15 minutes per IP
 */
export const loginLimiter = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
};

/**
 * Apply rate limit to a request (database-based, serverless-compatible)
 * Returns NextResponse with error if limit exceeded, null otherwise
 *
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @param keyPrefix - Prefix for the rate limit key (e.g., 'signup', 'login')
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  keyPrefix: string
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const identifier = `${keyPrefix}:${ip}`;

  return checkRateLimit(identifier, keyPrefix, config);
}

/**
 * Clear all rate limit entries (for testing purposes)
 */
export async function clearRateLimitStore(): Promise<void> {
  try {
    await db.query('DELETE FROM rate_limits');
  } catch (err) {
    console.error('Error clearing rate limit store:', err);
  }
}
