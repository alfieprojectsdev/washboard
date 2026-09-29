-- Migration 002: feedback inbox + queue integrity
-- Date: 2026-09-26
-- Safe to re-run.

-- ============================================
-- FEEDBACK
-- Written by POST /api/feedback (the "Feedback" button on every page).
-- Read it in the Neon SQL editor:
--   SELECT created_at, kind, message, contact, page FROM feedback ORDER BY created_at DESC;
-- ============================================
CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  kind VARCHAR(20) NOT NULL DEFAULT 'other',
  message TEXT NOT NULL,
  contact VARCHAR(200),
  page VARCHAR(300),
  user_agent VARCHAR(300),
  user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  branch_code VARCHAR(20) REFERENCES branches(branch_code) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT feedback_kind CHECK (kind IN ('problem', 'idea', 'other')),
  CONSTRAINT feedback_message_length CHECK (char_length(message) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- ============================================
-- One booking per magic link, enforced by the database.
-- The submit route already claims the link atomically; this index is the
-- backstop if a future code path forgets to. Creation fails (and the whole
-- migration rolls back) if production already holds duplicates; find them with:
--   SELECT magic_link_id, COUNT(*) FROM bookings
--   WHERE magic_link_id IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_one_per_magic_link
  ON bookings(magic_link_id) WHERE magic_link_id IS NOT NULL;
