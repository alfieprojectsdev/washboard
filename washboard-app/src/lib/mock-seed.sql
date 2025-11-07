-- mock-seed.sql
-- Test data for Washboard development and testing
-- This file is loaded into pg-mem for testing purposes

-- Note: Password hashes are for 'password123' (bcrypt, saltRounds=12)
-- Pre-generated hash: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6

-- ============================================
-- BRANCHES (Already created by schema.sql)
-- ============================================
-- MAIN branch already exists from schema

-- Add a second branch for multi-branch testing
INSERT INTO branches (branch_code, branch_name, location, avg_service_minutes, is_active)
VALUES
  ('DWTN01', 'Downtown Branch', '123 Main St, Manila', 25, TRUE)
ON CONFLICT (branch_code) DO NOTHING;

-- ============================================
-- USERS (Receptionist accounts)
-- ============================================
-- Password for all test users: 'password123'
INSERT INTO users (branch_code, username, password_hash, name, email, role)
VALUES
  ('MAIN', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6',
   'Admin User', 'admin@washboard.test', 'admin'),

  ('MAIN', 'maria', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6',
   'Maria Santos', 'maria@washboard.test', 'receptionist'),

  ('DWTN01', 'juan', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5aeJkcg/T8fK6',
   'Juan Dela Cruz', 'juan@washboard.test', 'receptionist')
ON CONFLICT (branch_code, username) DO NOTHING;

-- ============================================
-- SHOP_STATUS (Already created by schema.sql for MAIN)
-- ============================================
INSERT INTO shop_status (branch_code, is_open, reason, updated_by)
VALUES
  ('DWTN01', TRUE, NULL, (SELECT user_id FROM users WHERE username = 'juan'))
ON CONFLICT (branch_code) DO NOTHING;

-- ============================================
-- CUSTOMER_MAGIC_LINKS
-- ============================================
INSERT INTO customer_magic_links (
  branch_code, token, customer_name, customer_messenger,
  expires_at, used_at, booking_id, created_by
)
VALUES
  -- Active link (not used, not expired)
  ('MAIN', 'test-token-active-abc123', 'Pedro Garcia', 'm.me/pedrogarcia',
   NOW() + INTERVAL '24 hours', NULL, NULL,
   (SELECT user_id FROM users WHERE username = 'maria')),

  -- Used link (booking completed)
  ('MAIN', 'test-token-used-def456', 'Ana Lopez', 'm.me/analopez',
   NOW() + INTERVAL '24 hours', NOW() - INTERVAL '2 hours', 1,
   (SELECT user_id FROM users WHERE username = 'maria')),

  -- Expired link (not used, expired)
  ('MAIN', 'test-token-expired-ghi789', 'Carlos Reyes', 'm.me/carlosreyes',
   NOW() - INTERVAL '1 hour', NULL, NULL,
   (SELECT user_id FROM users WHERE username = 'maria')),

  -- Downtown branch link
  ('DWTN01', 'test-token-dwtn-jkl012', 'Rosa Martinez', 'm.me/rosamartinez',
   NOW() + INTERVAL '24 hours', NULL, NULL,
   (SELECT user_id FROM users WHERE username = 'juan'));

-- ============================================
-- BOOKINGS
-- ============================================
INSERT INTO bookings (
  branch_code, magic_link_id, plate, vehicle_make, vehicle_model,
  customer_name, customer_messenger, preferred_time, status, position, notes
)
VALUES
  -- MAIN branch bookings
  -- Position 1: Queued (via magic link)
  ('MAIN', (SELECT id FROM customer_magic_links WHERE token = 'test-token-used-def456'),
   'ABC1234', 'Toyota', 'Vios', 'Ana Lopez', 'm.me/analopez',
   NOW() + INTERVAL '1 hour', 'queued', 1, 'Please wash exterior only'),

  -- Position 2: Queued
  ('MAIN', NULL, 'XYZ5678', 'Honda', 'City', 'Manuel Cruz', 'm.me/manuelcruz',
   NOW() + INTERVAL '2 hours', 'queued', 2, NULL),

  -- Position 3: Queued
  ('MAIN', NULL, 'DEF9012', 'Mitsubishi', 'Mirage', 'Lisa Tan', 'm.me/lisatan',
   NOW() + INTERVAL '3 hours', 'queued', 3, 'Interior and exterior'),

  -- In service
  ('MAIN', NULL, 'GHI3456', 'Nissan', 'Almera', 'Roberto Santos', NULL,
   NOW() - INTERVAL '30 minutes', 'in_service', 0, 'Express wash'),

  -- Completed
  ('MAIN', NULL, 'JKL7890', 'Mazda', '2', 'Carmen Reyes', 'm.me/carmenreyes',
   NOW() - INTERVAL '2 hours', 'done', 0, NULL),

  -- Cancelled
  ('MAIN', NULL, 'MNO1234', 'Suzuki', 'Swift', 'Diego Fernandez', 'm.me/diegof',
   NOW() - INTERVAL '1 hour', 'cancelled', 0, 'No water supply'),

  -- DWTN01 branch bookings
  ('DWTN01', NULL, 'PQR5678', 'Ford', 'Ranger', 'Elena Castro', 'm.me/elenacastro',
   NOW() + INTERVAL '1 hour', 'queued', 1, 'Truck wash - large vehicle'),

  ('DWTN01', NULL, 'STU9012', 'Hyundai', 'Accent', 'Miguel Ramos', NULL,
   NOW() + INTERVAL '2 hours', 'queued', 2, NULL);

-- Update magic_link booking_id for used link
UPDATE customer_magic_links
SET booking_id = (SELECT id FROM bookings WHERE customer_name = 'Ana Lopez' LIMIT 1)
WHERE token = 'test-token-used-def456';

-- ============================================
-- SUMMARY
-- ============================================
SELECT
  'Mock seed data loaded successfully' AS status,
  (SELECT COUNT(*) FROM branches) AS branches_count,
  (SELECT COUNT(*) FROM users) AS users_count,
  (SELECT COUNT(*) FROM customer_magic_links) AS magic_links_count,
  (SELECT COUNT(*) FROM bookings) AS bookings_count,
  (SELECT COUNT(*) FROM shop_status) AS shop_status_count;
