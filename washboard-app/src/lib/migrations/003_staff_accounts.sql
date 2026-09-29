-- Migration 003: staff management (invite links, password resets, removing access)
-- Date: 2026-09-29
-- Safe to re-run.

-- Removed staff keep their row (bookings and magic links reference it) but
-- can no longer log in; their sessions are deleted when access is removed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Single-use links an admin sends to staff:
--   invite: create an account in the admin's branch (valid 7 days)
--   reset:  set a new password for an existing account (valid 24 hours)
-- Only the SHA-256 of the token is stored; the link is shown once.
CREATE TABLE IF NOT EXISTS account_tokens (
  id BIGSERIAL PRIMARY KEY,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('invite', 'reset')),
  token_hash CHAR(64) NOT NULL UNIQUE,
  branch_code VARCHAR(20) NOT NULL REFERENCES branches(branch_code) ON DELETE CASCADE,
  -- reset: the account being reset. invite: the account created, once used.
  user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'receptionist' CHECK (role IN ('receptionist', 'admin')),
  note VARCHAR(100),
  created_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT reset_needs_user CHECK (kind <> 'reset' OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_account_tokens_pending ON account_tokens(branch_code, kind) WHERE used_at IS NULL;
