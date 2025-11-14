-- Database Setup: Required Initial Data
-- This script ensures all required initial data exists in the database.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING).
--
-- Usage:
--   psql $DATABASE_URL < scripts/setup-required-data.sql
--
-- Or from Vercel/production:
--   Run this via your database provider's SQL console

-- 1. Ensure MAIN branch exists
INSERT INTO branches (branch_code, branch_name, location, avg_service_minutes)
VALUES ('MAIN', 'Main Branch', 'Primary Location', 20)
ON CONFLICT (branch_code) DO NOTHING;

-- 2. Ensure MAIN shop status exists (shop is OPEN by default)
INSERT INTO shop_status (branch_code, is_open, reason)
VALUES ('MAIN', true, NULL)
ON CONFLICT (branch_code) DO NOTHING;

-- Verification queries (uncomment to check):
-- SELECT * FROM branches WHERE branch_code = 'MAIN';
-- SELECT * FROM shop_status WHERE branch_code = 'MAIN';
