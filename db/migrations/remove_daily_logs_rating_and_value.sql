-- Migration: Remove rating and value columns from daily_logs table
-- This migration:
-- 1. Drops the chk_daily_logs_rating_range constraint
-- 2. Removes the rating column
-- 3. Removes the value column

BEGIN;

-- Step 1: Drop the rating range constraint if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_daily_logs_rating_range') THEN
    ALTER TABLE daily_logs DROP CONSTRAINT chk_daily_logs_rating_range;
  END IF;
END $$;

-- Step 2: Drop the rating column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'rating'
  ) THEN
    ALTER TABLE daily_logs DROP COLUMN rating;
  END IF;
END $$;

-- Step 3: Drop the value column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'value'
  ) THEN
    ALTER TABLE daily_logs DROP COLUMN value;
  END IF;
END $$;

-- Verification: Ensure the columns were removed
DO $$
BEGIN
  -- Check that rating column was removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'rating'
  ) THEN
    RAISE EXCEPTION 'Migration failed: rating column still exists';
  END IF;
  
  -- Check that value column was removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_logs' 
    AND column_name = 'value'
  ) THEN
    RAISE EXCEPTION 'Migration failed: value column still exists';
  END IF;
  
  -- Check that rating constraint was removed
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_daily_logs_rating_range'
  ) THEN
    RAISE EXCEPTION 'Migration failed: chk_daily_logs_rating_range constraint still exists';
  END IF;
END $$;

COMMIT;

