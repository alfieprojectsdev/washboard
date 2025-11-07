// src/lib/auth/rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';

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
 * Rate limit entry for tracking requests
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory store for rate limiting
 * Note: In production, consider using Redis for distributed rate limiting
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically (every 5 minutes)
 */
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];

  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => rateLimitStore.delete(key));
}, 5 * 60 * 1000);

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
 * Check rate limit for a given identifier and config
 * Returns NextResponse with error if limit exceeded, null otherwise
 */
function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): NextResponse | null {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    // First request or window expired - create new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return null;
  }

  if (entry.count >= config.max) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    return NextResponse.json(
      config.message,
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
        }
      }
    );
  }

  // Increment count
  entry.count += 1;
  rateLimitStore.set(identifier, entry);

  return null;
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
 * Apply rate limit to a request
 * Returns NextResponse with error if limit exceeded, null otherwise
 *
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @param keyPrefix - Prefix for the rate limit key (e.g., 'signup', 'login')
 */
export function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  keyPrefix: string
): NextResponse | null {
  const ip = getClientIp(request);
  const identifier = `${keyPrefix}:${ip}`;

  return checkRateLimit(identifier, config);
}
