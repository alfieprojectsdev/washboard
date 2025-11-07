// src/lib/auth/middleware.ts
import type { AuthenticatedUser } from './passport-config';

/**
 * Express-like request with Passport.js authentication
 */
export interface AuthRequest {
  isAuthenticated?: () => boolean;
  user?: AuthenticatedUser;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

/**
 * Express-like response for API routes
 */
export interface AuthResponse {
  status: (code: number) => AuthResponse;
  json: (data: unknown) => void;
}

/**
 * Ensure user is authenticated
 * Returns user object if authenticated, null otherwise
 */
export function ensureAuthenticated(req: AuthRequest): AuthenticatedUser | null {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return null;
  }
  return req.user as AuthenticatedUser;
}

/**
 * Ensure user has specific role
 * Returns true if user has required role, false otherwise
 */
export function ensureRole(user: AuthenticatedUser, requiredRole: string | string[]): boolean {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(user.role);
}

/**
 * Ensure user can only access their own branch data
 * Returns true if branch_code matches user's branch, false otherwise
 */
export function ensureBranchAccess(user: AuthenticatedUser, branchCode: string): boolean {
  return user.branchCode === branchCode.toUpperCase();
}

/**
 * Middleware wrapper for API routes
 * Ensures user is authenticated before calling handler
 */
export function withAuth(
  handler: (req: AuthRequest, res: AuthResponse, user: AuthenticatedUser) => Promise<unknown>
) {
  return async (req: AuthRequest, res: AuthResponse) => {
    const user = ensureAuthenticated(req);

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    return handler(req, res, user);
  };
}

/**
 * Middleware wrapper with role check
 * Ensures user is authenticated AND has required role
 */
export function withRole(
  requiredRole: string | string[],
  handler: (req: AuthRequest, res: AuthResponse, user: AuthenticatedUser) => Promise<unknown>
) {
  return async (req: AuthRequest, res: AuthResponse) => {
    const user = ensureAuthenticated(req);

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!ensureRole(user, requiredRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }

    return handler(req, res, user);
  };
}

/**
 * Error response helpers for consistent error handling
 */
export const AuthErrors = {
  UNAUTHORIZED: {
    status: 401,
    error: 'Authentication required',
    code: 'UNAUTHORIZED'
  },
  FORBIDDEN: {
    status: 403,
    error: 'Insufficient permissions',
    code: 'FORBIDDEN'
  },
  INVALID_BRANCH: {
    status: 403,
    error: 'Cannot access data from different branch',
    code: 'INVALID_BRANCH'
  }
} as const;

/**
 * Type guard for authenticated requests
 */
export function isAuthenticated(user: AuthenticatedUser | null): user is AuthenticatedUser {
  return user !== null;
}
