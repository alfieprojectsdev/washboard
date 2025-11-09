-- Migration 001: Initial Schema (Up)
-- Applies the complete Washboard database schema
-- Date: 2025-11-07

-- Read and execute schema.sql
-- \i ../schema.sql
\i /home/ltpt420/repos/washboard/washboard-app/src/lib/schema.sql


-- Verify migration
SELECT 'Migration 001_initial_schema_up completed successfully' AS status;
