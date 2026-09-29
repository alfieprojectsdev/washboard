-- Migration 001: Initial Schema (Down)
-- Rolls back the complete Washboard database schema
-- Date: 2025-11-07
-- WARNING: This will delete all data!

BEGIN;

-- Drop triggers first
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_branches_updated_at ON branches;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS schema_version CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS shop_status CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS customer_magic_links CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

-- Drop extensions if needed
-- DROP EXTENSION IF EXISTS "uuid-ossp";

COMMIT;

SELECT 'Migration 001_initial_schema_down completed - all tables dropped' AS status;
