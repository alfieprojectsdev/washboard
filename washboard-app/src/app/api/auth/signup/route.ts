// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import db from '@/lib/db';
import { applyRateLimit, signupLimiter } from '@/lib/auth/rate-limit';

/**
 * POST /api/auth/signup
 * Create a receptionist account. Invite-only.
 *
 * Until 2026-09-26 anyone who guessed the branch code ("MAIN" is the default
 * and was prefilled on the form) could create an account and read every
 * customer's name, plate and Messenger handle. Signup now also requires
 * invite_code to match the SIGNUP_INVITE_CODE environment variable; with the
 * variable unset, signup is closed. The owner sets a code, shares it with the
 * new receptionist, and changes or removes it afterwards.
 *
 * Also: 3 attempts per hour per IP (which also limits invite-code guessing),
 * 12-character minimum password, bcrypt cost 12, unique username per branch.
 */
function inviteCodeMatches(supplied: unknown): boolean {
  const expected = process.env.SIGNUP_INVITE_CODE;
  if (!expected || typeof supplied !== 'string') {
    return false;
  }
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!process.env.SIGNUP_INVITE_CODE) {
    return NextResponse.json(
      { error: 'Signup is closed. Ask the shop owner for an invite code.', code: 'SIGNUP_CLOSED' },
      { status: 403 }
    );
  }

  const rateLimitResult = await applyRateLimit(request, signupLimiter, 'signup');
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = await request.json();
    const { branch_code, username, password, name, email, invite_code } = body;

    if (!inviteCodeMatches(invite_code)) {
      return NextResponse.json(
        { error: 'Invalid invite code', code: 'INVALID_INVITE' },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!branch_code || !username || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // P0 Security: Validate password strength (12 chars minimum)
    if (password.length < 12) {
      return NextResponse.json(
        {
          error: 'Password must be at least 12 characters long',
          code: 'WEAK_PASSWORD'
        },
        { status: 400 }
      );
    }

    // Validate username format (alphanumeric, underscore, hyphen, 3-50 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        {
          error: 'Username must be 3-50 characters (letters, numbers, underscore, hyphen only)',
          code: 'INVALID_USERNAME'
        },
        { status: 400 }
      );
    }

    // Validate email format (if provided)
    if (email) {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          {
            error: 'Invalid email format',
            code: 'INVALID_EMAIL'
          },
          { status: 400 }
        );
      }
    }

    // Verify branch exists
    const branchResult = await db.query(
      'SELECT branch_code FROM branches WHERE branch_code = $1 AND is_active = TRUE',
      [branch_code.toUpperCase()]
    );

    if (branchResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid branch code',
          code: 'INVALID_BRANCH'
        },
        { status: 400 }
      );
    }

    // Check for duplicate username in branch
    const existingUser = await db.query(
      'SELECT user_id FROM users WHERE branch_code = $1 AND username = $2',
      [branch_code.toUpperCase(), username.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          error: 'Username already exists in this branch',
          code: 'DUPLICATE_USERNAME'
        },
        { status: 409 }
      );
    }

    // P0 Security: Hash password with bcrypt (saltRounds=12)
    const password_hash = await bcrypt.hash(password, 12);

    // Create user
    const result = await db.query(
      `INSERT INTO users
       (branch_code, username, password_hash, name, email, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, branch_code, username, name, email, role, created_at`,
      [
        branch_code.toUpperCase(),
        username.toLowerCase(),
        password_hash,
        name,
        email || null,
        'receptionist'
      ]
    );

    const newUser = result.rows[0];

    // Return user data (WITHOUT password_hash)
    return NextResponse.json(
      {
        success: true,
        user: {
          userId: newUser.user_id,
          branchCode: newUser.branch_code,
          username: newUser.username,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.created_at
        }
      },
      { status: 201 }
    );

  } catch (err: unknown) {
    console.error('Signup error:', err);

    // Handle database constraint violations
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      return NextResponse.json(
        {
          error: 'Username already exists in this branch',
          code: 'DUPLICATE_USERNAME'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create account. Please try again.',
        code: 'SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}
