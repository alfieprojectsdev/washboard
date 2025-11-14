-- schema.sql
-- Washboard Car Wash Queue Management System
-- Database Schema v1.0

-- Enable UUID extension (optional, for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- BRANCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS branches (
  branch_code VARCHAR(20) PRIMARY KEY,
  branch_name VARCHAR(100) NOT NULL,
  location TEXT,
  avg_service_minutes INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE branches IS 'Car wash branch/franchise locations';
COMMENT ON COLUMN branches.avg_service_minutes IS 'Average minutes per car wash (for wait time estimation)';

-- ============================================
-- USERS TABLE (Receptionist accounts)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  branch_code VARCHAR(20) NOT NULL REFERENCES branches(branch_code) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) DEFAULT 'receptionist',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints (from auth analysis P0 fixes)
  CONSTRAINT valid_username CHECK (username ~ '^[a-zA-Z0-9_-]{3,50}$'),
  CONSTRAINT password_length CHECK (LENGTH(password_hash) >= 60),
  CONSTRAINT valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT valid_role CHECK (role IN ('receptionist', 'admin'))
);

COMMENT ON TABLE users IS 'Receptionist and admin accounts';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash (60+ chars)';

-- CRITICAL: Correct index column order (branch_code FIRST for login queries)
CREATE UNIQUE INDEX idx_users_branch_username ON users(branch_code, username);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

-- ============================================
-- CUSTOMER_MAGIC_LINKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customer_magic_links (
  id BIGSERIAL PRIMARY KEY,
  branch_code VARCHAR(20) NOT NULL REFERENCES branches(branch_code) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  customer_name VARCHAR(100),
  customer_messenger VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  booking_id BIGINT,
  created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_messenger CHECK (
    customer_messenger IS NULL OR
    customer_messenger ~* '^(https?:\/\/)?(m\.me|fb\.com|facebook\.com)\/[A-Za-z0-9._-]+$'
  )
);

COMMENT ON TABLE customer_magic_links IS 'One-time magic links for customer booking access';
COMMENT ON COLUMN customer_magic_links.token IS 'Secure random token (single-use, 24h expiration)';
COMMENT ON COLUMN customer_magic_links.used_at IS 'Timestamp when link was used (NULL = unused)';

CREATE INDEX idx_magic_links_token ON customer_magic_links(token) WHERE used_at IS NULL;
CREATE INDEX idx_magic_links_branch_active ON customer_magic_links(branch_code, expires_at)
  WHERE used_at IS NULL AND expires_at > NOW();

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  branch_code VARCHAR(20) NOT NULL REFERENCES branches(branch_code) ON DELETE CASCADE,
  magic_link_id BIGINT REFERENCES customer_magic_links(id),
  plate VARCHAR(20) NOT NULL,
  vehicle_make VARCHAR(50) NOT NULL,
  vehicle_model VARCHAR(50) NOT NULL,
  customer_name VARCHAR(100),
  customer_messenger VARCHAR(255),
  preferred_time TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  position INTEGER NOT NULL,
  cancelled_reason TEXT,
  cancelled_by INTEGER REFERENCES users(user_id),
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('queued', 'in_service', 'done', 'cancelled')),
  CONSTRAINT valid_position CHECK (position > 0)
);

COMMENT ON TABLE bookings IS 'Car wash queue bookings';
COMMENT ON COLUMN bookings.position IS 'Queue position (1 = first, 2 = second, etc.)';
COMMENT ON COLUMN bookings.magic_link_id IS 'Source magic link (if applicable)';

-- Performance indexes
CREATE INDEX idx_bookings_branch_status_position ON bookings(branch_code, status, position);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX idx_bookings_magic_link ON bookings(magic_link_id) WHERE magic_link_id IS NOT NULL;

-- ============================================
-- SHOP_STATUS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS shop_status (
  id SERIAL PRIMARY KEY,
  branch_code VARCHAR(20) NOT NULL REFERENCES branches(branch_code) ON DELETE CASCADE,
  is_open BOOLEAN DEFAULT TRUE,
  reason TEXT,
  updated_by INTEGER REFERENCES users(user_id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT one_status_per_branch UNIQUE(branch_code)
);

COMMENT ON TABLE shop_status IS 'Current open/closed status per branch';
COMMENT ON COLUMN shop_status.reason IS 'Closure reason (e.g., Maintenance, Power outage, Weather)';

CREATE INDEX idx_shop_status_branch ON shop_status(branch_code);

-- ============================================
-- SESSIONS TABLE (Enhanced per auth analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR(128) PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
  branch_code VARCHAR(20) REFERENCES branches(branch_code) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE sessions IS 'Express session store (enhanced with user_id and branch_code)';

CREATE INDEX idx_session_expire ON sessions(expire);
CREATE INDEX idx_session_user ON sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_session_branch ON sessions(branch_code) WHERE branch_code IS NOT NULL;

-- ============================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (Single "MAIN" branch)
-- ============================================
INSERT INTO branches (branch_code, branch_name, location, avg_service_minutes)
VALUES ('MAIN', 'Main Branch', 'Primary Location', 20)
ON CONFLICT (branch_code) DO NOTHING;

INSERT INTO shop_status (branch_code, is_open, reason)
VALUES ('MAIN', TRUE, NULL)
ON CONFLICT (branch_code) DO NOTHING;

-- ============================================
-- RATE LIMITING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  endpoint VARCHAR(100) NOT NULL,
  identifier VARCHAR(100) NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (endpoint, identifier)
);

COMMENT ON TABLE rate_limits IS 'Rate limiting for login/signup endpoints (serverless-compatible)';
COMMENT ON COLUMN rate_limits.endpoint IS 'API endpoint being rate limited (e.g., "login", "signup")';
COMMENT ON COLUMN rate_limits.identifier IS 'IP address or user identifier';
COMMENT ON COLUMN rate_limits.count IS 'Number of requests in current window';
COMMENT ON COLUMN rate_limits.window_start IS 'Start time of current rate limit window';

-- Index for efficient cleanup of old entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- ============================================
-- SCHEMA VERSION
-- ============================================
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schema_version (version) VALUES (1) ON CONFLICT DO NOTHING;

COMMENT ON TABLE schema_version IS 'Track schema migrations';
