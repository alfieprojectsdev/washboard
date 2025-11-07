// src/lib/auth/passport-config.ts
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import db from '../db';

/**
 * Configure Passport.js with local strategy for receptionist authentication.
 *
 * Authentication flow:
 * 1. User provides: username + password + branch_code
 * 2. Query DB: WHERE branch_code = $1 AND username = $2 (uses correct index)
 * 3. Verify password with bcrypt
 * 4. Return user object on success
 */
export function configurePassport() {
  // Local Strategy Configuration
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true, // Access req.body.branch_code
      },
      async (req, username, password, done) => {
        try {
          const { branch_code } = req.body;

          // Validate required fields
          if (!branch_code) {
            return done(null, false, { message: 'Invalid credentials' });
          }

          // Query with CORRECT index column order: (branch_code, username)
          // This uses idx_users_branch_username for optimal performance
          const result = await db.query(
            `SELECT user_id, branch_code, username, password_hash, name, email, role
             FROM users
             WHERE branch_code = $1 AND username = $2`,
            [branch_code.toUpperCase(), username.toLowerCase()]
          );

          // User not found - use generic error message (no username enumeration)
          if (result.rows.length === 0) {
            return done(null, false, { message: 'Invalid credentials' });
          }

          const user = result.rows[0];

          // Verify password with bcrypt
          const isValidPassword = await bcrypt.compare(password, user.password_hash);

          if (!isValidPassword) {
            // Wrong password - use same generic error (no username enumeration)
            return done(null, false, { message: 'Invalid credentials' });
          }

          // Authentication successful - return user object (without password_hash)
          return done(null, {
            userId: user.user_id,
            branchCode: user.branch_code,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
          });
        } catch (err) {
          console.error('Passport authentication error:', err);
          return done(err);
        }
      }
    )
  );

  /**
   * Serialize User
   * Store minimal data in session (just IDs)
   */
  passport.serializeUser((user: Express.User, done) => {
    const authUser = user as AuthenticatedUser;
    done(null, {
      userId: authUser.userId,
      branchCode: authUser.branchCode,
      username: authUser.username,
    });
  });

  /**
   * Deserialize User
   * P0 SECURITY FIX: Re-fetch user from database on every request
   * This ensures:
   * - Deleted users are immediately logged out
   * - Role changes take effect immediately
   * - No stale session data
   */
  passport.deserializeUser(async (sessionData: SessionData, done) => {
    try {
      const result = await db.query(
        `SELECT user_id, branch_code, username, name, email, role
         FROM users
         WHERE user_id = $1`,
        [sessionData.userId]
      );

      // User no longer exists (deleted or disabled)
      if (result.rows.length === 0) {
        return done(null, false);
      }

      const user = result.rows[0];

      // Return fresh user data from database
      done(null, {
        userId: user.user_id,
        branchCode: user.branch_code,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } catch (err) {
      console.error('Passport deserialize error:', err);
      done(err);
    }
  });
}

/**
 * TypeScript types for authenticated user
 */
export interface AuthenticatedUser {
  userId: number;
  branchCode: string;
  username: string;
  name: string;
  email: string | null;
  role: string;
}

/**
 * Session data stored in cookie
 */
interface SessionData {
  userId: number;
  branchCode: string;
  username: string;
}

export default passport;
