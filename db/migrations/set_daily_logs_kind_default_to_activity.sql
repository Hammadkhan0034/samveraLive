-- Migration: Set default kind to 'activity' for daily_logs table
-- This migration updates the default value for the kind column from 'note' to 'activity'
-- to align with the application logic that defaults to 'activity'

BEGIN;

-- Update the default value for the kind column
ALTER TABLE daily_logs ALTER COLUMN kind SET DEFAULT 'activity';

-- Verification: Ensure the default value was updated correctly
DO $$
BEGIN
  -- Check that the default value is now 'activity'
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'kind'
    AND column_default = '''activity''::daily_log_kind'
  ) THEN
    RAISE EXCEPTION 'Migration failed: kind column default value is not set to ''activity''';
  END IF;
END $$;

COMMIT;

